const twoPi = 2 * Math.PI;
const deg2rad = deg => deg * Math.PI / 180;
const lat = deg2rad(50.0833);

const skySpeed = 300000;
const satSpeed = 3000;
const morseSpeed = 500;
const minDistance = 3;
const maxDistance = 8;
const angleSpread = deg2rad(10);
const colorSpread = 0.0;
const timeSpread = 0.2;

window.addEventListener('DOMContentLoaded', async _ => {
  const canvas = document.querySelector('canvas');
  const gl = canvas.getContext('webgl2');
  const ratio = window.devicePixelRatio || 1;

  const bkg = new Program(gl, await fetch('bkg.vert').then(r => r.text()), await fetch('bkg.frag').then(r => r.text()));
  const sat = new Program(gl, await fetch('sat.vert').then(r => r.text()), await fetch('sat.frag').then(r => r.text()));

  bkg.tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, bkg.tex);
  gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, await loadImage('GalaxyTex_PositiveX.png'));
  gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, await loadImage('GalaxyTex_NegativeX.png'));
  gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, await loadImage('GalaxyTex_PositiveY.png'));
  gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, await loadImage('GalaxyTex_NegativeY.png'));
  gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, await loadImage('GalaxyTex_PositiveZ.png'));
  gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, await loadImage('GalaxyTex_NegativeZ.png'));
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAX_LOD, 2);
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

  const mErtObs = [
    1, 0, 0,
    0, Math.sin(lat), -Math.cos(lat),
    0, Math.cos(lat), Math.sin(lat),
  ];
  const mTexSun = [
    -.671607, +.740907, 0,
    +.453492, +.411075, +.487277,
    +.361027, +.327259, -.612076,
  ];

  sat.buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sat.buffer);
  gl.enableVertexAttribArray(sat.coords);
  gl.vertexAttribPointer(sat.coords, 4, gl.FLOAT, false, 32, 0);
  gl.vertexAttribDivisor(sat.coords, 1);
  gl.enableVertexAttribArray(sat.color);
  gl.vertexAttribPointer(sat.color, 4, gl.FLOAT, false, 32, 16);
  gl.vertexAttribDivisor(sat.color, 1);

  const lightData = [
    [1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0],
    [1, 1, 1, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0],
    [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0],
    [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0],
    //[1, 0, 1, 0, 0, 0, 0, 0],
    //[1, 1, 1, 0, 0, 0, 0, 0]
  ];
  const getLight = (sat, time) => lightData[sat][time % lightData[sat].length];
  const count = lightData.length;

  const satData = [];
  const colorComp = (hue, i) => 1 + colorSpread * (Math.cos(hue - i * twoPi / 3) - 1) / 2;
  for(let i = 0; i < count; i++) {
    const hue = i / count * twoPi;
    satData.push({
      angles: [Math.random() * twoPi, Math.PI / 2 + angleSpread * (2 * Math.random() - 1), Math.random() * twoPi],
      color: [colorComp(hue, 0), colorComp(hue, 1), colorComp(hue, 2)],
      timeConst: 1 + timeSpread * Math.random()
    });
  }

  function drawFrame(time) {
    const width = canvas.width = canvas.clientWidth * ratio;
    const height = canvas.height = canvas.clientHeight * ratio;
    const angle = deg2rad(50);
    const itan = 1 / Math.tan(angle);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const rot = time / skySpeed;

    const mProj = [
      -itan * height / width, 0, 0, 0,
      0, -itan, 0, 0,
      0, 0, 1, 1,
      0, 0, 0, 0
    ];
    const mSunErt = [
      Math.cos(rot), -Math.sin(rot), 0,
      Math.sin(rot), Math.cos(rot), 0,
      0, 0, 1,
    ];

    gl.useProgram(bkg.program);
    gl.uniformMatrix4fv(bkg.mProj, false, mProj);
    gl.uniformMatrix3fv(bkg.mErtObs, false, mErtObs);
    gl.uniformMatrix3fv(bkg.mSunErt, false, mSunErt);
    gl.uniformMatrix3fv(bkg.mTexSun, false, mTexSun);
    gl.uniform1i(bkg.cubemap, bkg.tex);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const data = [];
    for(let i = 0; i < count; i++) {
      const r = minDistance + (maxDistance - minDistance) * i / count;
      const T = satSpeed * Math.pow(r, 3/2);
      const iTime = Math.round(time / morseSpeed * satData[i].timeConst);
      const sat = [];
      sat.push(...satData[i].angles);
      sat[2] += time / T % twoPi;
      sat.push(r);
      sat.push(...satData[i].color);
      sat.push(getLight(i, iTime));
      data.push(...sat);
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STREAM_DRAW);

    gl.useProgram(sat.program);
    gl.uniformMatrix4fv(sat.mProj, false, mProj);
    gl.uniformMatrix3fv(sat.mErtObs, false, mErtObs);
    gl.uniformMatrix3fv(sat.mSunErt, false, mSunErt);
    gl.uniformMatrix3fv(sat.mTexSun, false, mTexSun);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);

    requestAnimationFrame(drawFrame);
  }

  requestAnimationFrame(drawFrame);
});

function Shader(ctx, type, source) {
  var shader = ctx.createShader(type);
  ctx.shaderSource(shader, source);
  ctx.compileShader(shader);
  if(!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
    console.log(ctx.getShaderInfoLog(shader));
    ctx.deleteShader(shader);
    throw 'Shader compilation failed.';
  }
  this.shader = shader;
}

function Program(ctx, vs, fs) {
  var program = ctx.createProgram();
  function attach(s, type) {
    if(s instanceof Shader)
      ctx.attachShader(program, s.shader);
    else
      ctx.attachShader(program, new Shader(ctx, type, s).shader);
  }
  attach(vs, ctx.VERTEX_SHADER);
  attach(fs, ctx.FRAGMENT_SHADER);

  ctx.linkProgram(program);
  if(!ctx.getProgramParameter(program, ctx.LINK_STATUS)) {
    console.log(ctx.getProgramInfoLog(program));
    ctx.deleteProgram(program);
    throw 'Program linking failed.';
  }

  this.program = program;
  const numUniforms = ctx.getProgramParameter(program, ctx.ACTIVE_UNIFORMS);
  for(let i = 0; i < numUniforms; i++) {
    let name = ctx.getActiveUniform(program, i).name;
    if(name.indexOf('[') > 0)
      name = name.substring(0, name.indexOf('['));
    const loc = ctx.getUniformLocation(program, name);
    this[name] = loc;
  }
  const numAttribs = ctx.getProgramParameter(program, ctx.ACTIVE_ATTRIBUTES);
  for(let i = 0; i < numAttribs; i++) {
    const name = ctx.getActiveAttrib(program, i).name;
    const loc = ctx.getAttribLocation(program, name);
    this[name] = loc;
  }
}

function loadImage(filename) {
  const image = new Image();
  image.src = filename;
  return new Promise((res, rej) => image.onload = _ => res(image));
}
