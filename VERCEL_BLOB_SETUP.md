
📝 SETUP INSTRUCTIONS FOR VERCEL BLOB
═══════════════════════════════════════════════════════════════════════════════

To enable persistent audio storage in production:

1️⃣  Enable Vercel Blob Storage:
   
   a) Go to your Vercel dashboard
   b) Select your project: tts-article-reader
   c) Go to Storage tab
   d) Click 'Create Database' → 'Blob'
   e) Follow the setup wizard

2️⃣  Add Environment Variable (Automatic):
   
   Vercel will automatically add BLOB_READ_WRITE_TOKEN to your project
   when you create the Blob store. No manual configuration needed!

3️⃣  Verify Installation:
   
   Check your Vercel project settings → Environment Variables
   You should see: BLOB_READ_WRITE_TOKEN = vercel_blob_rw_...

4️⃣  Deploy:
   
   The next deployment will automatically use Vercel Blob Storage!

═══════════════════════════════════════════════════════════════════════════════
💰 PRICING (Vercel Blob):
   • Storage: $0.15/GB per month
   • Bandwidth: $0.20/GB transferred
   • First 1GB storage FREE
   • First 100GB bandwidth FREE per month

Typical usage: ~$5-10/month for moderate use
═══════════════════════════════════════════════════════════════════════════════

