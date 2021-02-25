const { execSync } = require("child_process");
const presets = require("butterchurn-presets");
const names = Object.keys(presets.default);

let fastest = { time: Infinity, name: "" };
let slowest = { time: 0, name: "" };
const times = [];
names.forEach((name, i) => {
  const output = execSync(`node compiler.js "${i}"`, {
    encoding: "utf-8",
  });
  const time = Number(output);
  if (time > slowest.time) {
    slowest = { time, name };
  }
  if (time < fastest.time) {
    fastest = { time, name };
  }
  times.push(time);
});
const total = times.reduce((prev, curr) => prev + curr);
console.log(
  `
Fastest: ${fastest.time.toFixed(2)} ${fastest.name}
Slowest: ${slowest.time.toFixed(2)} ${slowest.name}
Average: ${(total / times.length).toFixed(2)}
`.trim()
);
