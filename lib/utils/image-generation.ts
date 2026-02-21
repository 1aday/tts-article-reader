/**
 * Image Generation Utilities for Nano Banana Pro
 * Content-expressive prompts using 6-part structure optimized for reasoning-based generation
 */

export const CATEGORY_COLOR_SCHEMES: Record<string, string> = {
  Technology: "Netflix red (#e50914), crimson, dark navy blue",
  News: "purple (#a855f7), pink (#ec4899), charcoal gray",
  Politics: "purple (#a855f7), pink (#ec4899), charcoal gray",
  Business: "royal blue (#3b82f6), orange, slate gray",
  Science: "Netflix red (#e50914), crimson, white",
  Culture: "pink (#ec4899), peach, cream",
  Lifestyle: "pink (#ec4899), peach, cream",
  Entertainment: "pink (#ec4899), peach, cream",
  Sports: "orange (#fb923c), yellow, black",
  Health: "green (#10b981), mint, white",
  default: "Netflix red (#e50914), white, black"
};

interface StyleGuide {
  approach: string;           // How to conceptually approach the subject
  composition: string;        // Framing and layout guidelines
  style: string;             // Visual aesthetic and color palette
  lighting: string;          // Lighting setup and mood
  publicationReference: string; // Real-world quality benchmark
}

/**
 * Extract key subject from article title by removing stop words
 */
function extractKeySubject(title: string): string {
  const stopWords = ['the', 'a', 'an', 'of', 'in', 'to', 'for', 'and', 'or', 'is', 'are', 'at', 'by', 'on', 'with', 'from', 'as', 'how', 'why', 'what', 'when', 'where'];

  return title
    .split(' ')
    .filter(word => !stopWords.includes(word.toLowerCase()))
    .slice(0, 6) // Take more keywords for Nano Banana Pro's reasoning
    .join(' ');
}

function toTitleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function buildCatchyHeadline(title: string, category: string): string {
  const tokens = title
    .replace(/[-|:]/g, " ")
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);

  const stopWords = new Set([
    "the", "and", "for", "with", "from", "that", "this", "into", "after", "over", "under",
    "inside", "about", "their", "there", "where", "when", "what", "how", "why", "article",
    "times", "york", "new"
  ]);

  const coreWords = tokens.filter((word) => !stopWords.has(word.toLowerCase()));
  const core = toTitleCase(coreWords.slice(0, 3).join(" "));

  const templatesByCategory: Record<string, string[]> = {
    Technology: ["Code Red: {core}", "Inside {core}", "{core} Rewired"],
    News: ["Inside The Shift", "{core} Under Fire", "Breaking: {core}"],
    Politics: ["Power Play: {core}", "Inside The Standoff", "{core} Under Pressure"],
    Business: ["Market Shock: {core}", "The {core} Playbook", "{core} At Stake"],
    Science: ["The {core} Breakthrough", "Inside {core}", "{core} Unlocked"],
    Entertainment: ["Spotlight: {core}", "{core} After Dark", "{core} Unscripted"],
    default: ["Inside {core}", "{core} Under Pressure", "The {core} Story"]
  };

  const templates = templatesByCategory[category] || templatesByCategory.default;
  const template = templates[stableHash(title) % templates.length];
  const fallback = core || "Inside The Story";
  const headline = template.replace("{core}", fallback);

  // Keep title short and punchy for small-screen readability.
  return headline.length > 34 ? headline.slice(0, 31).trimEnd() + "..." : headline;
}

function buildMobileKicker(keySubject: string): string {
  const short = keySubject
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");

  const fallback = short || "Special Report";
  const kicker = toTitleCase(fallback);
  return kicker.length > 20 ? kicker.slice(0, 17).trimEnd() + "..." : kicker;
}

/**
 * Get category-specific style guide for Nano Banana Pro
 * Each category gets a unique visual treatment optimized for content expression
 */
function getCategoryStyleGuide(category: string): StyleGuide {
  const guides: Record<string, StyleGuide> = {
    Technology: {
      approach: "modern, forward-thinking innovation with clean lines and sophisticated design",
      composition: "Balanced composition with a clear focal point. Use dynamic angles that suggest progress and advancement. Incorporate subtle geometric elements or interface elements that don't overwhelm.",
      style: "Contemporary professional photography with a tech-forward aesthetic. Color palette dominated by Netflix red (#e50914), crimson accents, and deep navy backgrounds. Clean, minimalist approach with pops of vibrant accent colors. Cinematic quality with shallow depth of field.",
      lighting: "Soft, diffused lighting with subtle blue/cyan tints suggesting digital environments. Rim lighting to separate subjects from background. Modern studio setup with controlled highlights.",
      publicationReference: "Wired or MIT Technology Review"
    },

    News: {
      approach: "impactful photojournalism that captures the gravity and human element of current events",
      composition: "Documentary-style framing with authentic, unposed moments. Use the rule of thirds, leading lines that draw the eye to the story's heart. Environmental context is crucial.",
      style: "Photojournalistic realism with rich, saturated colors. Authentic environmental details. Color palette featuring deep purples (#a855f7), vibrant pinks (#ec4899), and dramatic charcoal grays. High contrast, emotionally resonant.",
      lighting: "Natural, realistic lighting that reflects the actual environment. May include dramatic shadows or golden hour warmth depending on the story's tone. Authentic atmosphere over artificial perfection.",
      publicationReference: "Time Magazine or The Atlantic"
    },

    Politics: {
      approach: "authoritative, serious imagery that conveys power, governance, and societal impact",
      composition: "Formal, structured composition with strong vertical or horizontal lines suggesting stability or tension. Architectural elements, government buildings, or symbols of authority in context.",
      style: "Editorial political photography with gravitas. Bold color choices: deep purples (#a855f7), commanding pinks (#ec4899), and serious charcoal backgrounds. Professional yet accessible. Sharp detail throughout.",
      lighting: "Controlled, professional lighting suggesting official settings. May use dramatic side lighting for depth and character. Mix of natural light from grand windows and supplemental lighting.",
      publicationReference: "Politico or Foreign Affairs"
    },

    Business: {
      approach: "sophisticated corporate imagery that conveys strategy, growth, and professional excellence",
      composition: "Organized, intentional framing suggesting order and strategic thinking. May include data visualization elements, modern office environments, or collaboration scenarios. Clean sight lines.",
      style: "High-end corporate photography with aspirational quality. Color palette: royal blues (#3b82f6), energetic orange accents, and sleek slate grays. Professional, polished, with attention to materials and textures. Premium feel.",
      lighting: "Bright, clean lighting with soft shadows suggesting a modern office environment. Large windows, natural daylight mixed with warm interior lighting. Professional studio quality with subtle warmth.",
      publicationReference: "Harvard Business Review or Bloomberg Businessweek"
    },

    Science: {
      approach: "awe-inspiring scientific imagery that makes complex concepts visually accessible and fascinating",
      composition: "Macro details or vast scale compositions that reveal hidden beauty in scientific subjects. Symmetry and pattern where relevant. Clear visual hierarchy leading to the key concept.",
      style: "Scientific editorial photography with stunning detail. Color palette: Netflix red (#e50914), crimson accents, and clean white or deep space backgrounds. Crisp focus, revealing texture and structure. May incorporate subtle data visualization.",
      lighting: "Clinical precision lighting that reveals detail, or dramatic lighting that emphasizes form and texture. May use colored gels (cyan, teal) for scientific aesthetic. High key or dramatic chiaroscuro depending on subject.",
      publicationReference: "National Geographic or Scientific American"
    },

    Culture: {
      approach: "vibrant, expressive imagery celebrating human creativity, tradition, and contemporary cultural movements",
      composition: "Dynamic, energetic framing that captures motion and emotion. May be asymmetrical and artistic. Layered compositions with foreground, middle, and background interest.",
      style: "Artistic documentary photography with rich, warm tones. Color palette: vibrant pinks (#ec4899), soft peach, and creamy backgrounds. Authentic, lived-in environments. Celebrates texture, pattern, and color.",
      lighting: "Warm, inviting lighting with golden tones. Natural light preferred, creating authentic atmosphere. May include practical lights (lamps, candles) for warmth and intimacy. Soft shadows and highlights.",
      publicationReference: "Kinfolk or Monocle"
    },

    Lifestyle: {
      approach: "aspirational yet relatable imagery that captures contemporary living with authenticity and style",
      composition: "Approachable, inviting compositions with negative space for breathing room. Lifestyle moments captured with editorial polish. Natural, unforced arrangements.",
      style: "Contemporary lifestyle photography with editorial refinement. Color palette: soft pinks (#ec4899), warm peach tones, and cream backgrounds. Natural materials, authentic settings. Clean aesthetic with warmth.",
      lighting: "Soft, flattering natural light streaming through windows. Golden hour glow or bright, airy daytime light. Minimal shadows, gentle highlights. Warm white balance for comfort and appeal.",
      publicationReference: "Bon Appétit or Architectural Digest"
    },

    Entertainment: {
      approach: "captivating, energetic imagery that conveys excitement, glamour, and cultural relevance",
      composition: "Bold, attention-grabbing framing with strong visual impact. May use dramatic angles or unconventional perspectives. Dynamic movement or stillness with tension.",
      style: "High-fashion editorial meets entertainment photography. Vibrant color palette: electric pinks (#ec4899), rich jewel tones, and dramatic contrasts. Cinematic quality with mood and atmosphere.",
      lighting: "Dramatic, theatrical lighting with strong directionality. Stage lighting effects, colored gels, or moody atmospheric lighting. High contrast between light and shadow for impact.",
      publicationReference: "Vanity Fair or Rolling Stone"
    },

    Sports: {
      approach: "dynamic action imagery that captures peak performance, determination, and athletic excellence",
      composition: "Action-focused composition with frozen motion or intentional blur suggesting speed. Diagonal lines creating energy. Close-ups on determination or wide shots showing athletic environment.",
      style: "Sports editorial photography with high energy. Color palette: vibrant oranges (#fb923c), bold yellows, and deep black backgrounds for contrast. Sharp detail on the athlete, environment may blur.",
      lighting: "Dynamic lighting that emphasizes muscle definition and motion. Stadium lights, dramatic side lighting, or natural outdoor light. High-speed flash freezing action with sharp detail.",
      publicationReference: "ESPN The Magazine or Sports Illustrated"
    },

    Health: {
      approach: "uplifting, trustworthy imagery that conveys wellness, vitality, and professional medical care",
      composition: "Balanced, harmonious composition suggesting wellbeing. May include natural elements, modern medical environments, or active lifestyle scenarios. Clean, organized framing.",
      style: "Clean, contemporary health editorial photography. Color palette: fresh greens (#10b981), mint accents, and bright whites. Crisp, clear detail suggesting cleanliness and precision. Aspirational yet authentic.",
      lighting: "Bright, clean lighting suggesting health and vitality. Natural daylight or bright clinical lighting. Soft shadows, even illumination. White balance trending slightly cool for clinical settings or warm for wellness.",
      publicationReference: "Health Magazine or Mayo Clinic publications"
    },

    default: {
      approach: "versatile, professional imagery that adapts to the specific article content",
      composition: "Balanced, intentional composition following rule of thirds. Clear focal point with supporting elements. Professional framing with purpose.",
      style: "Editorial photography with contemporary aesthetic. Color palette: Netflix red (#e50914), clean whites, and deep blacks. Modern, sophisticated, adaptable to content.",
      lighting: "Professional studio lighting or well-controlled natural light. Flattering, even illumination with subtle shadows for depth. Technical precision.",
      publicationReference: "The New Yorker or Medium publications"
    }
  };

  return guides[category] || guides.default;
}

/**
 * Build a detailed, content-expressive prompt for Nano Banana Pro
 * Leverages the model's reasoning capabilities for superior relevance
 */
export function buildImagePrompt(article: {
  title: string;
  categories: string[];
  summary?: string;
}): string {
  // Extract key concepts from title and summary
  const keySubject = extractKeySubject(article.title);
  const contentContext = article.summary?.slice(0, 500) || article.title;

  // Determine visual style based on category
  const category = article.categories[0] || 'default';
  const coverHeadline = buildCatchyHeadline(article.title, category);
  const coverKicker = buildMobileKicker(keySubject);
  const styleGuide = getCategoryStyleGuide(category);

  const cinematicDirection = `
CINEMATIC POSTER DIRECTION:
- Treat this as premium theatrical key art for a film inspired by the article.
- Create one striking, story-rich frame with strong emotional tension and visual drama.
- Use cinematic depth, atmosphere, and scale (foreground, midground, background) to feel like a movie scene.
- Prioritize dynamic composition, dramatic perspective, and a clear hero subject that represents the article's core idea.
- Use high-impact lighting: motivated highlights, deep shadows, and controlled contrast for a dramatic look.
- Ensure the scene is contextually accurate to the article topic, not generic stock imagery.
  `.trim();

  // Build comprehensive, reasoning-friendly prompt
  return `
Create a professional, high-quality magazine cover image for an article titled "${article.title}".

SUBJECT & CONCEPT:
The image should visually represent the core topic: ${keySubject}
Article context: ${contentContext}

The visual concept should capture the essence of this article through ${styleGuide.approach}.

COMPOSITION & FRAMING:
${styleGuide.composition}

VISUAL STYLE:
${styleGuide.style}

LIGHTING & ATMOSPHERE:
${styleGuide.lighting}

${cinematicDirection}

TYPOGRAPHY (MANDATORY):
- Include cover text on the image, like premium streaming/Netflix key art.
- Primary headline text to render clearly: "${coverHeadline}"
- Secondary kicker line: "${coverKicker}"
- Do NOT use the full original article title. Keep cover copy short, catchy, and cinematic.
- Typography style: bold cinematic sans-serif, modern, high-contrast, dramatic hierarchy.
- Mobile-first readability is mandatory: large type, clean spacing, and clear hierarchy for phone screens.
- Ensure text is legible against the background with proper placement, scale, and contrast.
- Keep generous safe margins so no key text is cropped on small screens.
- Text should feel integrated into the composition, not pasted on.

TECHNICAL SPECIFICATIONS:
- Shot like a ${styleGuide.publicationReference} magazine cover
- Also quality-matched to modern cinematic movie-poster key art
- Professional editorial quality
- Rich detail and depth
- 3:4 portrait orientation
- High resolution, print-ready quality

IMPORTANT GUIDELINES:
- The image must clearly relate to the article's subject matter
- Create a visually arresting scene that captures the article's most intriguing concept
- Make the frame feel dramatic and cinematic without becoming fantasy-irrelevant
- Use article context details accurately so people, setting, and objects match the story
- Include polished, readable headline typography matching the article concept
- Maintain professional publication standards
- Ensure the visual story aligns with the article's narrative
  `.trim();
}

/**
 * Generate filename for generated image
 */
export function generateImageFilename(articleId: number): string {
  return `article-${articleId}-${Date.now()}.jpg`;
}
