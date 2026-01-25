// Create test article for GPT-5 nano testing
const sqlite = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, ".next", "server", "db", "sqlite.db");
const db = sqlite(dbPath);

const testArticle = {
  title: "GPT-5 Nano Test Article",
  originalText: `The future of artificial intelligence is here. AI technology has advanced rapidly over the past decade, transforming how we work, communicate, and solve problems.

From machine learning algorithms that power recommendation systems to natural language processing models that understand human speech, AI is everywhere. Companies like OpenAI, Google, and Microsoft are investing billions in AI research.

The GPT models, for example, can generate human-like text, answer questions, and even write code. They use transformer architecture with billions of parameters. The API allows developers to integrate these capabilities into their applications.

But with great power comes great responsibility. As AI becomes more capable, we must ensure it's developed ethically and used for good. This includes addressing bias, ensuring transparency, and protecting privacy.

The next decade will be crucial in determining how AI shapes our future. Will it enhance human potential or create new challenges? The answer depends on the choices we make today.`,
  sourceUrl: "https://example.com/gpt5-test",
  sourceType: "url",
};

try {
  const result = db.prepare(`
    INSERT INTO articles (title, originalText, sourceUrl, sourceType, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    testArticle.title,
    testArticle.originalText,
    testArticle.sourceUrl,
    testArticle.sourceType,
    new Date().toISOString()
  );

  console.log("✅ Test article created successfully");
  console.log(`   Article ID: ${result.lastInsertRowid}`);
  console.log(`   Title: ${testArticle.title}`);
  console.log(`   Text length: ${testArticle.originalText.length} characters`);
  console.log(`\n📝 Now run the test with:`);
  console.log(`   node test-gpt5-nano.js ${result.lastInsertRowid}`);

  db.close();
} catch (error) {
  console.error("❌ Error creating test article:", error.message);
  console.error("\n💡 Make sure the database exists:");
  console.error(`   Expected at: ${dbPath}`);
  db.close();
  process.exit(1);
}
