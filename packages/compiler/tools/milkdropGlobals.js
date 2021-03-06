const MILKDROP_GLOBALS = [
  // Per frame
  "enabled",
  "rating",
  "gammaadj",
  "decay",
  "fshader",
  "echo_zoom",
  "echo_alpha",
  "echo_orient",
  "additivewave",
  "wave_mode",
  "wave_dots",
  "wave_thick",
  "wave_brighten",
  "wave_scale",
  "wave_smoothing",
  "wave_mystery",
  "wave_a",
  "wave_r",
  "wave_g",
  "wave_b",
  "wave_x",
  "wave_y",
  "modwavealphabyvolume",
  "modwavealphastart",
  "modwavealphaend",
  "wrap",
  "darken_center",
  "red_blue",
  "brighten",
  "darken",
  "solarize",
  "invert",
  "warpanimspeed",
  "warpscale",
  "monitor",
  "zoomexp",
  "zoom",
  "rot",
  "cx",
  "cy",
  "dx",
  "dy",
  "warp",
  "sx",
  "sy",
  "ob_size",
  "ob_r",
  "ob_g",
  "ob_b",
  "ob_a",
  "ib_size",
  "ib_r",
  "ib_g",
  "ib_b",
  "ib_a",
  "mv_x",
  "mv_y",
  "mv_dx",
  "mv_dy",
  "mv_l",
  "mv_r",
  "mv_g",
  "mv_b",
  "mv_a",
  "b1n",
  "b2n",
  "b3n",
  "b1x",
  "b2x",
  "b3x",
  "b1ed",
  // Per pixel
  "x",
  "y",
  "rad",
  "ang",
  // per shape frame
  "r",
  "g",
  "b",
  "a",
  "r2",
  "g2",
  "b2",
  "a2",
  "x",
  "y",
  "rad",
  "ang",
  "border_r",
  "border_g",
  "border_b",
  "border_a",
  "additive",
  "thickoutline",
  "textured",
  "tex_zoom",
  "tex_ang",
  "sides",
  "instance",
  "num_inst",
  // per wave frame
  "r",
  "g",
  "b",
  "a",
  "samples",
  "scaling",
  "smoothing",
  "sep",
  "additive",
  "usedots",
  "spectrum",
  "thick",
  // per wave point
  "x",
  "y",
  "r",
  "g",
  "b",
  "a",
  "sample",
  "value1",
  "value2",
  // True global
  "time",
  "fps",
  "frame",
  "meshx",
  "meshy",
  "pixelsx",
  "pixelsy",
  "aspectx",
  "aspecty",
  "bass",
  "mid",
  "treb",
  "bass_att",
  "mid_att",
  "treb_att"
];

// q1 - q32
for (let i = 1; i <= 32; i++) {
  MILKDROP_GLOBALS.push(`q${i}`);
}

// t1-t8
for (let i = 1; i <= 8; i++) {
  MILKDROP_GLOBALS.push(`t${i}`);
}
// reg00-reg99
for (let i = 0; i <= 99; i++) {
  MILKDROP_GLOBALS.push(`reg${i}`);
}

// TODO: Arrays megabuf and gmegabuf

module.exports = MILKDROP_GLOBALS;
