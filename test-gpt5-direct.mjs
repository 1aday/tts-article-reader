// Direct test of GPT-5 nano enhancement function
// Run with: node test-gpt5-direct.mjs

import { enhanceText } from "./lib/api/openai.ts";

const testCases = [
  {
    name: "Short Blog Post",
    text: "The future of AI is here. AI technology has advanced rapidly, transforming how we work and communicate. Companies like OpenAI and Google are investing billions. The GPT models can generate text, answer questions, and write code. But we must ensure it's developed ethically. The next decade will determine how AI shapes our future.",
    category: "Blog",
  },
  {
    name: "Technical Article with Acronyms",
    text: "REST APIs are the backbone of modern web development. An API allows different software systems to communicate. When building a RESTful API, follow HTTP conventions. GET retrieves data, POST creates resources, PUT updates, DELETE removes. Status codes like 200, 404, and 500 tell clients what happened. JSON is the most common format.",
    category: "Technical",
  },
  {
    name: "News Article",
    text: "The Federal Reserve announced it will maintain interest rates. This comes amid inflation concerns. The chairman stated policymakers are monitoring indicators. Analysts predict rates will remain stable. The stock market gained 2.5% by close.",
    category: "News",
  },
];

console.log("🧪 Testing GPT-5 nano direct enhancement...\n");
console.log("=" + "=".repeat(59));

async function testEnhancement(testCase, index) {
  console.log(`\n📝 Test ${index + 1}: ${testCase.name}`);
  console.log("-".repeat(60));
  console.log(`   Category: ${testCase.category}`);
  console.log(`   Input length: ${testCase.text.length} chars`);

  const startTime = Date.now();

  try {
    const stream = await enhanceText(testCase.text);
    let enhancedText = "";
    let chunks = 0;

    for await (const chunk of stream) {
      enhancedText += chunk;
      chunks++;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Success`);
    console.log(`   Duration: ${duration}s`);
    console.log(`   Chunks: ${chunks}`);
    console.log(`   Output length: ${enhancedText.length} chars`);
    console.log(`   First 150 chars: "${enhancedText.substring(0, 150)}..."`);

    // Quality checks
    const warnings = [];
    if (enhancedText.length < testCase.text.length * 0.8) {
      warnings.push("Output significantly shorter than input");
    }
    if (enhancedText.length > testCase.text.length * 2) {
      warnings.push("Output significantly longer than input");
    }
    if (enhancedText.includes("[pause]")) {
      warnings.push("Contains [pause] tags (should not for v3)");
    }
    if (duration > 15) {
      warnings.push(`Slow response time (${duration}s)`);
    }

    if (warnings.length > 0) {
      console.log(`   ⚠️  Warnings:`);
      warnings.forEach((w) => console.log(`      - ${w}`));
    }

    return {
      success: true,
      duration: parseFloat(duration),
      testCase: testCase.name,
      chunks,
      inputLength: testCase.text.length,
      outputLength: enhancedText.length,
      warnings: warnings.length,
    };
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`❌ Failed after ${duration}s`);
    console.log(`   Error: ${error.message}`);
    console.log(`   Stack: ${error.stack?.split("\n")[0]}`);

    return {
      success: false,
      duration: parseFloat(duration),
      error: error.message,
      testCase: testCase.name,
    };
  }
}

async function runAllTests() {
  console.log("\n🔧 Testing GPT-5 nano with OpenAI API...");
  console.log("   Model: gpt-5-nano");
  console.log("   Parameters: verbosity=medium, reasoning_effort=low\n");

  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const result = await testEnhancement(testCases[i], i);
    results.push(result);

    // Wait between tests
    if (i < testCases.length - 1) {
      console.log("\n⏳ Waiting 2s before next test...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const totalWarnings = successful.reduce((sum, r) => sum + (r.warnings || 0), 0);

  console.log(`\n✅ Passed: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  console.log(`⚠️  Total warnings: ${totalWarnings}`);

  if (successful.length > 0) {
    const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
    const avgChunks = successful.reduce((sum, r) => sum + r.chunks, 0) / successful.length;
    console.log(`\n⏱️  Average duration: ${avgDuration.toFixed(2)}s`);
    console.log(`📦 Average chunks: ${Math.round(avgChunks)}`);
  }

  if (failed.length > 0) {
    console.log("\n❌ Failed tests:");
    failed.forEach((r) => {
      console.log(`   - ${r.testCase}: ${r.error}`);
    });
  }

  console.log("\n" + "=".repeat(60));

  if (failed.length === 0 && totalWarnings === 0) {
    console.log("🎉 All tests passed with no warnings!");
    console.log("\n✅ GPT-5 nano migration verified");
    console.log("\n📋 Next steps:");
    console.log("   1. Monitor OpenAI dashboard for prompt caching");
    console.log("   2. Check cost reduction (target: ~40%+ savings)");
    console.log("   3. Verify cache hit rate >30% after 10+ requests");
    console.log("   4. Test the main project at /Users/am");
  } else if (failed.length === 0) {
    console.log("⚠️  Tests passed but with warnings. Review above.");
  } else {
    console.log("❌ Some tests failed. See errors above.");
    console.log("\n🔄 Rollback if needed:");
    console.log("   Edit /Users/am/Desktop/tts-article-reader/lib/api/openai.ts");
    console.log("   Change: model: 'gpt-4o-mini'");
    console.log("   Remove: verbosity and reasoning_effort parameters");
  }

  console.log("\n");
}

runAllTests().catch((error) => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});
