#!/usr/bin/env node

/**
 * Generate extension icons
 * Run with: node generate-icons.js
 *
 * Note: This requires canvas package. If not installed:
 * npm install canvas
 */

const fs = require('fs');
const path = require('path');

// Check if canvas is available
let Canvas;
try {
  Canvas = require('canvas');
} catch (err) {
  console.log('\x1b[33m%s\x1b[0m', '⚠️  canvas package not found. Installing...');
  console.log('\nPlease run: npm install canvas');
  console.log('\nOr use the create-icons.html file in a browser instead.\n');
  process.exit(1);
}

const { createCanvas } = Canvas;

const sizes = [16, 32, 48, 128];
const iconsDir = path.join(__dirname, 'icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

console.log('Generating extension icons...\n');

sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient (approximation for PNG)
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#00ff88');
  gradient.addColorStop(1, '#00d4ff');

  // Draw rounded rectangle background
  const radius = size * 0.2;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw icon symbol (music note emoji representation)
  ctx.fillStyle = '#000000';

  // Draw a simple audio wave pattern instead of emoji
  const centerX = size / 2;
  const centerY = size / 2;
  const waveSize = size * 0.5;

  // Three vertical bars of different heights (audio wave visualization)
  const barWidth = waveSize / 5;
  const bars = [
    { x: centerX - waveSize / 2, height: waveSize * 0.5 },
    { x: centerX - barWidth / 2, height: waveSize * 0.8 },
    { x: centerX + waveSize / 2 - barWidth, height: waveSize * 0.6 }
  ];

  bars.forEach(bar => {
    ctx.fillRect(
      bar.x,
      centerY - bar.height / 2,
      barWidth,
      bar.height
    );
  });

  // Save to file
  const filePath = path.join(iconsDir, `icon-${size}.png`);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buffer);

  console.log(`✓ Generated icon-${size}.png`);
});

console.log('\n✅ All icons generated successfully!\n');
