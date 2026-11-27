// ==============================================================================
// SUPABASE EDGE FUNCTION: sync-expense
// Purpose:
// 1. Google Cloud Service Account OAuth2 JWT Authentication
// 2. Uploads attached receipt image to company's Google Drive folder & renames it
//    strictly to {RECEIPT_CODE}.{ext} (e.g. CO1-20261127-001.jpg)
// 3. Live-syncs / upserts expense data to the company-specific Google Sheet
//    with exact 13 columns in order
// 4. Chronologically sorts the Google Sheet rows (Row 2+) by Date then Time
// 5. Updates Supabase record with drive_file_id, drive_file_url, and sync_status
// ==============================================================================

import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

// Convert Base64URL string
function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Convert PEM PKCS#8 private key string to ArrayBuffer for Web Crypto
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/[\r\n\s]/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate Google OAuth2 Access Token using Service Account JWT via Web Crypto API
async function getGoogleAccessToken(serviceAccount: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const claimSet = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets",
    aud: serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
    exp: expiry,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
  const unsignedToken = `${encodedHeader}.${encodedClaimSet}`;

  // Import PKCS8 RSA private key
  const keyBuffer = pemToArrayBuffer(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const encoder = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const encodedSignature = base64UrlEncodeBytes(new Uint8Array(signatureBuffer));
  const jwt = `${unsignedToken}.${encodedSignature}`;

  // Request OAuth2 access token
  const tokenResponse = await fetch(serviceAccount.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    throw new Error(`Failed to obtain Google access token: ${errText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Headers required in Google Sheets
const SHEET_HEADERS = [
  "Receipt Code",
  "Date",
  "Time",
  "Company",
  "Logged By",
  "Category",
  "Type of Payment",
  "Paid From",
  "Description / Reason",
  "Payment ID / UTR",
  "Amount (INR)",
  "Receipt Link",
  "Last Updated",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase configuration environment variables.");
    }

    if (!GOOGLE_SERVICE_ACCOUNT_KEY) {
      throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_KEY environment secret.");
    }

    let serviceAccount: ServiceAccountKey;
    try {
      serviceAccount = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not a valid JSON string.");
    }

    const { expense_id, old_company_id } = await req.json();
    if (!expense_id) {
      return new Response(JSON.stringify({ error: "Missing 'expense_id' parameter." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch expense with company and profile details
    const { data: expense, error: fetchErr } = await supabase
      .from("expenses")
      .select(`
        *,
        company:companies(*),
        user:profiles(full_name, email)
      `)
      .eq("id", expense_id)
      .single();

    if (fetchErr || !expense) {
      throw new Error(`Expense not found: ${fetchErr?.message || "Unknown ID"}`);
    }

    const company = expense.company;
    if (!company) {
      throw new Error("Associated company record not found for expense.");
    }

    // Authenticate with Google
    const accessToken = await getGoogleAccessToken(serviceAccount);

    let driveFileId = expense.drive_file_id || "";
    let driveFileUrl = expense.drive_file_url || "";
    let driveUploadError = "";

    // 2. Upload receipt image to Google Drive if attached and no drive_file_id yet
    if (expense.receipt_image_path && !driveFileId) {
      try {
        // Download image from Supabase Storage
        const { data: fileData, error: downloadErr } = await supabase.storage
          .from("receipts")
          .download(expense.receipt_image_path);

        if (downloadErr) {
          console.error("Storage download error:", downloadErr);
          driveUploadError = `Storage download failed: ${downloadErr.message}`;
        } else if (fileData) {
          const extension = expense.receipt_image_path.split(".").pop() || "jpg";
          const targetFileName = `${expense.receipt_code}.${extension}`;

          const metadata: any = {
            name: targetFileName,
          };
          if (company.google_drive_folder_id) {
            metadata.parents = [company.google_drive_folder_id];
          }

          const fileBytes = new Uint8Array(await fileData.arrayBuffer());
          const boundary = "-------314159265358979323846";
          const delimiter = `\r\n--${boundary}\r\n`;
          const closeDelimiter = `\r\n--${boundary}--`;

          const multipartBody = new Blob([
            delimiter,
            'Content-Type: application/json; charset=UTF-8\r\n\r\n',
            JSON.stringify(metadata),
            delimiter,
            `Content-Type: ${fileData.type || 'image/jpeg'}\r\n\r\n`,
            fileBytes,
            closeDelimiter,
          ]);

          const driveUploadRes = await fetch(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": `multipart/related; boundary=${boundary}`,
              },
              body: multipartBody,
            }
          );

          if (driveUploadRes.ok) {
            const driveData = await driveUploadRes.json();
            driveFileId = driveData.id;
            driveFileUrl = driveData.webViewLink || `https://drive.google.com/file/d/${driveFileId}/view`;

            // Make file readable to anyone with link (or company workspace)
            await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}/permissions?supportsAllDrives=true`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                role: "reader",
                type: "anyone",
              }),
            });
          } else {
            const errTxt = await driveUploadRes.text();
            console.error("Drive upload failed:", errTxt);
            driveUploadError = errTxt;
          }
        }
      } catch (uploadError: any) {
        console.error("Error during Drive file upload:", uploadError);
        driveUploadError = uploadError?.message || String(uploadError);
      }
    }

    // 3. Live Sync to Company's Google Sheet
    if (company.google_sheet_id) {
      const sheetId = company.google_sheet_id;
      let tabName = company.sheet_tab_name || "Expenses";

      // Dynamically resolve active tab name in the spreadsheet
      try {
        const metaRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          const titles = (metaData.sheets || []).map((s: any) => s.properties?.title);
          if (titles.length > 0) {
            if (titles.includes(tabName)) {
              // configured tabName exists
            } else if (titles.includes("Sheet1")) {
              tabName = "Sheet1";
            } else {
              tabName = titles[0];
            }
          }
        }
      } catch (e) {
        console.warn("Could not inspect sheet tabs:", e);
      }

      // Check if header row exists
      const headerCheckRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName)}!A1:M1`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!headerCheckRes.ok) {
        const errText = await headerCheckRes.text();
        throw new Error(`Google Sheets range check failed (${tabName}): ${errText}`);
      }

      const headerCheckData = await headerCheckRes.json();
      if (!headerCheckData.values || headerCheckData.values.length === 0) {
        // Write headers
        const putHeaderRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName)}!A1:M1?valueInputOption=USER_ENTERED`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ values: [SHEET_HEADERS] }),
          }
        );
        if (!putHeaderRes.ok) {
          throw new Error(`Failed to write headers to Google Sheet: ${await putHeaderRes.text()}`);
        }
      }

      // Read Column A to locate row by Receipt Code
      const colARes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName)}!A:A`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (!colARes.ok) {
        throw new Error(`Failed to read Column A from Google Sheet: ${await colARes.text()}`);
      }
      const colAData = await colARes.json();
      const existingRows = colAData.values || [];

      let targetRowIndex = -1; // 1-based index for Google Sheets
      for (let i = 0; i < existingRows.length; i++) {
        if (existingRows[i][0] === expense.receipt_code) {
          targetRowIndex = i + 1;
          break;
        }
      }

      const publicStorageUrl = expense.receipt_image_path
        ? `${SUPABASE_URL}/storage/v1/object/public/receipts/${expense.receipt_image_path}`
        : null;
      const receiptLink = driveFileUrl || publicStorageUrl || "Cash / No Receipt";
      const nowFormatted = new Date().toISOString().replace("T", " ").substring(0, 19);

      // Exact 13 columns
      const rowValues = [
        expense.receipt_code,
        expense.expense_date,
        expense.expense_time ? expense.expense_time.substring(0, 5) : "12:00",
        company.name,
        expense.user?.full_name || "Member",
        expense.category,
        expense.payment_type,
        expense.paid_from,
        expense.description || "-",
        expense.payment_id || "-",
        Number(expense.amount),
        receiptLink,
        nowFormatted,
      ];

      if (targetRowIndex > 0) {
        // Update row in place
        const updateRange = `${tabName}!A${targetRowIndex}:M${targetRowIndex}`;
        const updateRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(updateRange)}?valueInputOption=USER_ENTERED`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ values: [rowValues] }),
          }
        );
        if (!updateRes.ok) {
          throw new Error(`Failed to update row in Google Sheet: ${await updateRes.text()}`);
        }
      } else {
        // Append row
        const appendRange = `${tabName}!A:M`;
        const appendRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ values: [rowValues] }),
          }
        );
        if (!appendRes.ok) {
          throw new Error(`Failed to append row to Google Sheet: ${await appendRes.text()}`);
        }
      }

      // If company changed, remove the row from the old company's sheet
      if (old_company_id && old_company_id !== company.id) {
        try {
          const { data: oldComp } = await supabase
            .from("companies")
            .select("google_sheet_id, sheet_tab_name")
            .eq("id", old_company_id)
            .single();

          if (oldComp?.google_sheet_id) {
            const oldTab = oldComp.sheet_tab_name || "Expenses";
            const oldColARes = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${oldComp.google_sheet_id}/values/${encodeURIComponent(oldTab)}!A:A`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const oldColAData = await oldColARes.json();
            const oldRows = oldColAData.values || [];
            let oldRowIdx = -1;
            for (let j = 0; j < oldRows.length; j++) {
              if (oldRows[j][0] === expense.receipt_code) {
                oldRowIdx = j; // 0-based index
                break;
              }
            }

            if (oldRowIdx > 0) {
              // Get sheetId (numeric tab gid)
              const metaRes = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${oldComp.google_sheet_id}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );
              const metaData = await metaRes.json();
              const sheetObj = metaData.sheets?.find(
                (s: any) => s.properties?.title === oldTab
              );
              const sheetGid = sheetObj?.properties?.sheetId || 0;

              // Delete row from old sheet
              await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${oldComp.google_sheet_id}:batchUpdate`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    requests: [
                      {
                        deleteDimension: {
                          range: {
                            sheetId: sheetGid,
                            dimension: "ROWS",
                            startIndex: oldRowIdx,
                            endIndex: oldRowIdx + 1,
                          },
                        },
                      },
                    ],
                  }),
                }
              );
            }
          }
        } catch (cleanupErr) {
          console.error("Failed to clean up old sheet row:", cleanupErr);
        }
      }

      // 4. Chronological Date & Time Sorting:
      // Sort rows 2 onwards ascending by Date (Col B, index 1) then Time (Col C, index 2)
      try {
        const metaRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const metaData = await metaRes.json();
        const sheetObj = metaData.sheets?.find(
          (s: any) => s.properties?.title === tabName
        );
        const sheetGid = sheetObj?.properties?.sheetId || 0;

        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              requests: [
                {
                  sortRange: {
                    range: {
                      sheetId: sheetGid,
                      startRowIndex: 1, // Skip header row
                      startColumnIndex: 0,
                      endColumnIndex: 13,
                    },
                    sortSpecs: [
                      {
                        dimensionIndex: 1, // Column B: Date
                        sortOrder: "ASCENDING",
                      },
                      {
                        dimensionIndex: 2, // Column C: Time
                        sortOrder: "ASCENDING",
                      },
                    ],
                  },
                },
              ],
            }),
          }
        );
      } catch (sortErr) {
        console.error("Sheet chronological sorting warning:", sortErr);
      }
    }

    // 5. Update Supabase expense record as Synced
    const fallbackPhotoUrl = expense.receipt_image_path
      ? `${SUPABASE_URL}/storage/v1/object/public/receipts/${expense.receipt_image_path}`
      : null;

    const { error: updateErr } = await supabase
      .from("expenses")
      .update({
        drive_file_id: driveFileId,
        drive_file_url: driveFileUrl || fallbackPhotoUrl,
        sync_status: "synced",
        sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", expense_id);

    if (updateErr) {
      throw updateErr;
    }

    return new Response(
      JSON.stringify({
        success: true,
        receipt_code: expense.receipt_code,
        drive_file_url: driveFileUrl,
        drive_upload_error: driveUploadError || null,
        sync_status: "synced",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    const errorMsg = err.message || "Unknown error during sync";
    console.error("Sync Expense Error:", errorMsg);

    // Record failure in Supabase if possible
    try {
      const { expense_id } = await req.clone().json();
      if (expense_id) {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          await supabase
            .from("expenses")
            .update({
              sync_status: "failed",
              sync_error: errorMsg,
              updated_at: new Date().toISOString(),
            })
            .eq("id", expense_id);
        }
      }
    } catch (_) {
      // Ignore inner catch
    }

    return new Response(
      JSON.stringify({ error: errorMsg, sync_status: "failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
