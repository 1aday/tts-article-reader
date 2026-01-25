// Test script for GPT-5 nano migration
// Run with: node test-gpt5-nano.js

const testCases = [
  {
    name: "Short Blog Post (500 words)",
    text: "The future of artificial intelligence is here. AI technology has advanced rapidly over the past decade, transforming how we work, communicate, and solve problems. From machine learning algorithms that power recommendation systems to natural language processing models that understand human speech, AI is everywhere. Companies like OpenAI, Google, and Microsoft are investing billions in AI research. The GPT models, for example, can generate human-like text, answer questions, and even write code. But with great power comes great responsibility. As AI becomes more capable, we must ensure it's developed ethically and used for good. The next decade will be crucial in determining how AI shapes our future.",
    expectedDuration: 5
  },
  {
    name: "Technical Article with Acronyms",
    text: "REST APIs are the backbone of modern web development. An API (Application Programming Interface) allows different software systems to communicate. When building a RESTful API, you need to follow HTTP conventions. For example, GET requests retrieve data, POST creates new resources, PUT updates existing ones, and DELETE removes them. Status codes like 200, 404, and 500 tell clients what happened. JSON is the most common data format. Modern frameworks like Express.js make it easy to build APIs in Node.js.",
    expectedDuration: 5
  },
  {
    name: "News Article (Formal)",
    text: "The Federal Reserve announced today that it will maintain interest rates at their current levels. This decision comes amid concerns about inflation and economic growth. The central bank's chairman stated that policymakers are closely monitoring economic indicators. Analysts predict that rates will remain stable through the end of the year. The stock market reacted positively to the news, with major indices gaining 2.5% by market close.",
    expectedDuration: 5
  }
];

console.log("🧪 Testing GPT-5 nano migration...\n");
console.log("=" .repeat(60));

async function testEnhancement(testCase, index) {
  console.log(`\n📝 Test ${index + 1}: ${testCase.name}`);
  console.log("-".repeat(60));

  const startTime = Date.now();

  try {
    const response = await fetch("http://localhost:3000/api/enhance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: testCase.text,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let enhancedText = "";
    let chunks = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      enhancedText += chunk;
      chunks++;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Success`);
    console.log(`   Duration: ${duration}s`);
    console.log(`   Chunks received: ${chunks}`);
    console.log(`   Input length: ${testCase.text.length} chars`);
    console.log(`   Output length: ${enhancedText.length} chars`);
    console.log(`   First 100 chars: ${enhancedText.substring(0, 100)}...`);

    if (duration > testCase.expectedDuration * 2) {
      console.log(`   ⚠️  Warning: Took longer than expected (${testCase.expectedDuration}s)`);
    }

    return { success: true, duration: parseFloat(duration), testCase: testCase.name };
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`❌ Failed after ${duration}s`);
    console.log(`   Error: ${error.message}`);
    return { success: false, duration: parseFloat(duration), error: error.message, testCase: testCase.name };
  }
}

async function runAllTests() {
  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const result = await testEnhancement(testCases[i], i);
    results.push(result);

    // Wait a bit between tests to avoid rate limiting
    if (i < testCases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

  console.log(`\n✅ Passed: ${successful}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  console.log(`⏱️  Average duration: ${avgDuration.toFixed(2)}s`);

  if (failed > 0) {
    console.log("\n❌ Failed tests:");
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.testCase}: ${r.error}`);
    });
  }

  console.log("\n" + "=".repeat(60));

  if (failed === 0) {
    console.log("🎉 All tests passed! GPT-5 nano migration successful.");
    console.log("\n📋 Next steps:");
    console.log("   1. Check OpenAI dashboard for prompt caching metrics");
    console.log("   2. Monitor cost reduction (target: ~40%+ savings)");
    console.log("   3. Verify cache hit rate >30% after 10+ requests");
  } else {
    console.log("⚠️  Some tests failed. Check errors above.");
    console.log("\n🔄 Rollback instructions:");
    console.log("   1. Change model back to 'gpt-4o-mini'");
    console.log("   2. Remove verbosity and reasoning_effort parameters");
  }

  console.log("\n");
}

runAllTests().catch(console.error);
