
📚 Sponsor Leads API Documentation
1️⃣ Upload Sponsor Leads
Endpoint: /upload-sponsor-leads Purpose: Upload a CSV file containing sponsor leads. Required Parameters:
file → Path to the CSV file
sponsor_name → The name of the sponsor
Example cURL Command
curl -X POST http://ai.dealingwithdebt.org:3020/upload-sponsor-leads \
     -F "file=@/Users/vikas/Desktop/sponsor.csv" \
     -F "sponsor_name=ClearOne Advantage"

2️⃣ Invite Sponsor Leads
Endpoint: /invite-sponsor-leads Purpose: Invite all leads with a "pending" status for a specific sponsor. Required Parameters:
sponsorName → The name of the sponsor
Example cURL Command
curl -X POST http://ai.dealingwithdebt.org:3020/invite-sponsor-leads \
     -H "Content-Type: application/json" \
     -d '{
         "sponsorName": "ClearOne Advantage"
     }'

3️⃣ Update Sponsor Leads
Endpoint: /update-sponsor-leads Purpose: Upload a CSV file to update existing sponsor leads. All updated leads will be set to "pending" status. Required Parameters:
file → Path to the CSV file
Example cURL Command
curl -X POST http://ai.dealingwithdebt.org:3020/update-sponsor-leads \
     -F "file=@/Users/vikas/Desktop/sponsor.csv"

4️⃣ Delete Sponsor Leads
Endpoint: /delete-sponsor-leads Purpose: Upload a CSV file to delete specific sponsor leads. Required Parameters:
file → Path to the CSV file
Example cURL Command
curl -X POST http://ai.dealingwithdebt.org:3020/delete-sponsor-leads \
     -F "file=@/Users/vikas/Desktop/sponsor.csv"

5️⃣ Add a New Sponsor
Endpoint: /add-sponsor Purpose: Add a new sponsor and associate them with Mailchimp. Required Parameters (JSON Body):
sponsorName → The name of the sponsor
list → The Mailchimp list ID
apiKey → Mailchimp API key
prefix → Mailchimp server prefix
Example cURL Command
curl -X POST http://ai.dealingwithdebt.org:3020/add-sponsor \
     -H "Content-Type: application/json" \
     -d '{
         "sponsorName": "ClearOne Advantage",
         "list": "xxxxx",
         "apiKey": "xxxxxx",
         "prefix": "xxxxxx"
     }'

📃 Expected CSV Format
The CSV file should contain the following columns:
SPONSOR_NAME,CLIENT_FIRST,CLIENT_LAST,CLIENT_ZIP,CLIENT_EMAIL,CLIENT_MOBILE,CLIENT_STATE,CLIENT_DOB,CLIENT_ID,PROCESSOR_ACCT,CLIENT_STATUS,AFFILIATE_ENROLLED_DATE,SERVICE_TERM,DEBT_AMT_ENROLLED
Example CSV Row:
"ClearOne Advantage","John","Doe","78735","client@email.com","5128070696","TEXAS","1972-12-28","C79sd834T2","GLOBAL","enrolled","2025-03-13","42","38966.23"

✅ Final Notes
Ensure all requests use the correct API endpoints.
Use valid JSON formatting for POST requests that include a body.
All file-based requests must send the correct CSV format.
Uploaded leads will have an initial status of pending until invited.
🚀 Now your API is fully documented! Let me know if you need any modifications! 😊

