// ==============================================================================
// SUPABASE EDGE FUNCTION: parse-receipt
// Purpose: Analyzes payment screenshots (Paytm, PhonePe, GPay, Bank, Receipts)
// using Google Gemini Vision API to extract structured expense details.
// ==============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ParseResponse {
  amount: number | null;
  expense_date: string | null; // YYYY-MM-DD
  expense_time: string | null; // HH:MM
  payment_type: string;
  payment_id: string;
  merchant_or_payee: string;
  description: string;
  suggested_category: string;
  confidence_score: number;
  low_confidence_fields: string[];
  raw_ai_text?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Server configuration error: GEMINI_API_KEY is not set." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let imageBase64 = "";
    let mimeType = "image/jpeg";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) {
        return new Response(
          JSON.stringify({ error: "No image file provided in multipart form data." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      mimeType = file.type || "image/jpeg";
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      imageBase64 = btoa(binary);
    } else {
      // JSON payload
      const json = await req.json();
      if (!json.imageBase64) {
        return new Response(
          JSON.stringify({ error: "Missing 'imageBase64' or file in request body." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      imageBase64 = json.imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
      if (json.mimeType) {
        mimeType = json.mimeType;
      }
    }

    const promptText = `
You are an expert Indian payment receipt, bill & expense OCR extraction engine.
Your task is to analyze this image (which could be ANY format: Paytm, PhonePe, Google Pay, CRED, BHIM, Bank SMS, Delhi Metro QR ticket, Metro smart card recharge slip, MCD/NDMC/mall parking slip, Fastag receipt, fuel/petrol pump slip, Uber/Ola ride invoice, printed thermal POS cash memo, GST tax invoice, or hand-written vendor receipt).

Carefully read ALL text in English, Hindi, and numbers to extract the following structured details:

1. amount (number or null):
   - The final total amount paid in INR as a clean float (e.g. 150.00, 700.00, 20.00).
   - Strip all currency symbols (₹, Rs., INR, /-).
   - For UPI screens: The large highlighted paid amount.
   - For invoices/bills: The Grand Total, Net Payable, "कुल राशि", or "Total".
   - For parking/metro/bus tickets: The ticket fare or parking fee charged.

2. expense_date (string "YYYY-MM-DD" or null):
   - The transaction date. Parse formats like "27 Nov 2026", "27/11/2026", "27-11-26", "Today", etc. into strictly YYYY-MM-DD.
   - If only date and month are present, assume the year is 2026.
   - If no date is printed on a cash slip, return null.

3. expense_time (string "HH:MM" in 24-hr format or null):
   - Transaction or entry time (e.g. "09:43", "14:15", "21:30").
   - Convert 12-hour AM/PM to 24-hour (e.g. "03:15 PM" -> "15:15", "10:20 AM" -> "10:20").
   - If absent, return null.

4. payment_type (string):
   - Must be strictly one of:
     * 'Paytm / UPI' (Use for Paytm, PhonePe, GPay, BHIM, CRED, WhatsApp Pay, Amazon Pay, UPI QR scans)
     * 'Cash' (Use for physical cash memos, hand-written slips, parking tickets without digital payment ID, cash receipts)
     * 'Credit / Debit Card' (Use for card swipe POS slips with card number masking, e.g. ****1234)
     * 'Bank Transfer' (Use for NEFT, RTGS, IMPS bank transfer receipts or net banking)
     * 'Petty Cash' (Use for company petty voucher or internal cash slip)

5. payment_id (string):
   - UPI Ref ID, UTR number (e.g. 12-digit number like 433123891024), Paytm Order ID, Bank Ref No, Invoice No, Ticket No, or Parking Slip barcode number.
   - If not found on a cash slip, return an empty string "".

6. merchant_or_payee (string):
   - The recipient name, shop name, vendor, driver, parking authority, or organization paid.
   - Examples: "MUNNI DEVI", "Delhi Metro Rail Corporation", "MCD Parking Connaught Place", "Indian Oil Corporation", "Sharma Electricals", "Uber India", "Chai Point".

7. description (string):
   - A clear, concise 3-8 word summary of the expense purpose.
   - For UPI screens: Prioritize user-entered remarks/messages (e.g. "Add a message", "Remarks", "For: site travel").
   - For Metro: Station journey (e.g. "Metro ride from Rajiv Chowk to Noida Sector 18" or "Smart card recharge").
   - For Parking: Location (e.g. "Parking slip at Metro Station").
   - For Petrol: "Fuel refill at Indian Oil".
   - For Bills/Invoices: Main goods purchased (e.g. "Electrical supplies & wiring materials").

8. suggested_category (string):
   - Choose the single best match from:
     * 'Metro' (Delhi Metro, NMRC, metro tickets, card recharges)
     * 'Food & Tea' (Tea stall, snacks, restaurant, lunch, chai, bakery)
     * 'Rickshaw / Auto / Cab' (Auto fare, e-rickshaw, Uber, Ola, Rapido, cab ride)
     * 'Travel' (Bus ticket, train, toll plaza, Fastag, long distance travel)
     * 'Fuel / Vehicle' (Petrol, diesel, CNG, vehicle maintenance, tyre puncture, parking slip)
     * 'Office & Operations' (Printing, stationery, courier, cleaning, office supplies)
     * 'Supplies & Materials' (Hardware, tools, construction, raw material, manufacturing items)
     * 'Client Entertainment' (Client lunch, business dinner, meeting refreshments)
     * 'Petty Cash' (General petty office expense)
     * 'Misc' (Default fallback if unclear)

9. confidence_score (number):
   - Float between 0.0 and 1.0 indicating OCR certainty. (0.9+ for clear digital screens, 0.7-0.8 for thermal/faded slips).

10. low_confidence_fields (string[]):
    - List of any field names that were unreadable, absent, or guessed (e.g. ["payment_id"]).

Return ONLY valid JSON with this exact structure:
{
  "amount": number or null,
  "expense_date": "YYYY-MM-DD" or null,
  "expense_time": "HH:MM" or null,
  "payment_type": string,
  "payment_id": string,
  "merchant_or_payee": string,
  "description": string,
  "suggested_category": string,
  "confidence_score": number,
  "low_confidence_fields": string[]
}
`;

    // Call Gemini API (using gemini-flash-lite-latest with fallback to gemini-flash-latest)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_API_KEY}`;

    const geminiRequestBody = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        response_mime_type: "application/json",
      },
    };

    let geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiRequestBody),
    });

    if (!geminiResponse.ok) {
      // Fallback to gemini-flash-latest if flash-lite is experiencing high load
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
      geminiResponse = await fetch(fallbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiRequestBody),
      });
    }

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      return new Response(
        JSON.stringify({ error: "Gemini Vision API request failed", details: errorText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await geminiResponse.json();
    const candidateText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let parsedResult: ParseResponse;
    try {
      parsedResult = JSON.parse(candidateText);
    } catch {
      // If model returned markdown wrapping ```json ... ```
      const cleaned = candidateText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      parsedResult = JSON.parse(cleaned);
    }

    return new Response(JSON.stringify(parsedResult), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error parsing receipt" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
