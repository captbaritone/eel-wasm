const testCases = require("./testCases");

const lines = [`q1 = 1;`, `monitor = -1;`];
testCases.forEach(([description, code, expected], i) => {
  lines.push(`// ${i + 1}: ${description}`);
  lines.push(`g = 0; // Reset`);
  lines.push(`x = 10; // Reset`);
  lines.push(`megabuf(1000000) = 0; // Reset`);
  lines.push(`megabuf(0) = 0; // Reset`);
  lines.push(`megabuf(1) = 0; // Reset`);
  lines.push(`gmegabuf(0) = 0; // Reset`);
  lines.push(`gmegabuf(1) = 0; // Reset`);
  // TODO: Why can't we remove this `;`?
  lines.push(code + ";");
  lines.push(`pass = g == ${expected};`);
  lines.push(`monitor = if(!pass && monitor == -1, ${i + 1}, monitor);`);
  lines.push(`q1 = q1 && pass;`);
});

const perFrame = lines
  .map((line, i) => `per_frame_${i + 1}=${line}`)
  .join("\n");

const preset = `MILKDROP_PRESET_VERSION=201
PSVERSION=2
PSVERSION_WARP=2
PSVERSION_COMP=2
[preset00]
${perFrame}
warp_1=\`shader_body
warp_2=\`{
warp_3=\`    // sample previous frame
warp_4=\`    ret = tex2D( sampler_main, uv ).xyz;
warp_5=\`}
comp_1=\`shader_body
comp_2=\`{
comp_3=\`    if(q1) {
comp_4=\`      ret = float3(0,1,0);
comp_5=\`    } else {
comp_6=\`      ret = float3(1,0,0);
comp_7=\`    }
comp_8=\`}`;

console.log(preset);
