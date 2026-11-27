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
You are an expert Indian payment receipt & bill OCR system.
Analyze this payment screenshot (such as Paytm, PhonePe, Google Pay, CRED, BHIM, Bank SMS/App, Uber, Ola, Metro card recharge, POS slip, or physical invoice).

Extract the following information accurately:
1. amount: The transaction amount as a numeric float in INR (no currency symbol, e.g. 150.00).
2. expense_date: The transaction date in strictly YYYY-MM-DD format. If only day and month are present, assume the current year (2026).
3. expense_time: The transaction time in 24-hour format HH:MM (e.g. "14:35" or "09:15"). If absent, return null.
4. payment_type: One of: 'Paytm / UPI', 'Bank Transfer', 'Credit / Debit Card', 'Cash', 'Petty Cash'. Detect UPI apps (Paytm, PhonePe, GPay) as 'Paytm / UPI'.
5. payment_id: Transaction reference, UTR, UPI Ref No, Paytm Order ID, or Bank Reference number.
6. merchant_or_payee: Name of the person, shop, vendor, or business paid.
7. description: CRITICAL: Specifically scan for user-entered remarks, notes, "Add a message", "For", "Remarks", or purpose typed by the user in the Paytm/UPI/Bank screenshot (e.g., "lunch", "office chai", "auto fare to client", "stationery"). If none, synthesize a clear 3-5 word summary based on the merchant name.
8. suggested_category: Choose the single closest match from:
   - 'Metro'
   - 'Food & Tea'
   - 'Rickshaw / Auto / Cab'
   - 'Travel'
   - 'Petty Cash'
   - 'Office & Operations'
   - 'Supplies & Materials'
   - 'Client Entertainment'
   - 'Fuel / Vehicle'
   - 'Misc'
9. confidence_score: A number between 0.0 and 1.0 indicating overall parsing confidence.
10. low_confidence_fields: An array of field names (e.g. ["payment_id", "description"]) that were missing, inferred with low confidence, or require user review.

Return ONLY a valid JSON object with these exact keys:
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

    // Call Gemini API (using gemini-2.5-flash with fallback to gemini-1.5-flash)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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
      // Fallback to gemini-1.5-flash if 2.5-flash is temporarily unavailable
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
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
