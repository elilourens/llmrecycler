<template>
  <canvas ref="canvas" class="three-bg" />
</template>

<script setup lang="ts">
import * as THREE from 'three'

const props = defineProps<{
  pulseTrigger?: { x: number; y: number; ts: number }
}>()

const canvas = ref<HTMLCanvasElement | null>(null)

const VERT = /* glsl */`
  uniform float uTime;
  uniform vec2  uMouse;
  varying float vHeight;
  varying float vThick;
  varying vec2  vWorldPos;

  vec3 mod289v3(vec3 x){return x-floor(x*(1./289.))*289.;}
  vec4 mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}
  vec4 permute(vec4 x){return mod289v4(((x*34.)+1.)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}

  float snoise(vec3 v){
    const vec2 C=vec2(1./6.,1./3.);
    const vec4 D=vec4(0.,.5,1.,2.);
    vec3 i =floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289v3(i);
    vec4 p=permute(permute(permute(
      i.z+vec4(0.,i1.z,i2.z,1.))
      +i.y+vec4(0.,i1.y,i2.y,1.))
      +i.x+vec4(0.,i1.x,i2.x,1.));
    float n_=.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.+1.;
    vec4 s1=floor(b1)*2.+1.;
    vec4 sh=-step(h,vec4(0.));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
    vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
    m=m*m;
    return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  void main(){
    vec3 pos = position;
    float t = uTime * 0.06;

    float n  = snoise(vec3(pos.xy * 0.032 + uMouse * 0.08, t));
    float n2 = snoise(vec3(pos.xy * 0.065 + uMouse * 0.04, t * 1.2 + 40.));

    float h = n * 11.0 + n2 * 3.5;
    pos.z += h;
    vHeight   = h;
    vWorldPos = pos.xy;

    float thick1 = snoise(vec3(pos.xy * 0.022, t * 0.15 + 200.));
    float thick2 = snoise(vec3(pos.xy * 0.055, t * 0.25 + 400.));
    vThick = clamp(thick1 * 0.65 + thick2 * 0.35, -1., 1.) * 0.5 + 0.5;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const FRAG = /* glsl */`
  precision highp float;

  varying float vHeight;
  varying float vThick;
  varying vec2  vWorldPos;

  // xy = world origin, z = elapsed secs, w = active
  uniform vec4 uPulse;

  void main(){
    float freq   = 1.0;
    float scaled = vHeight * freq;

    float widthMod = mix(0.15, 5.0, vThick);

    float f  = fract(scaled);
    float fw = fwidth(scaled) * widthMod;

    float line = smoothstep(fw, 0., f) + smoothstep(1. - fw, 1., f);
    line = clamp(line, 0., 1.);

    float mScaled = vHeight * freq / 5.;
    float mf  = fract(mScaled);
    float mfw = fwidth(mScaled) * max(widthMod, 2.0);
    float major = clamp(smoothstep(mfw, 0., mf) + smoothstep(1. - mfw, 1., mf), 0., 1.);

    float brightness = clamp((vHeight + 12.) / 24., 0.15, 1.0);

    vec3 bg         = vec3(0.03);
    vec3 lineColor  = vec3(brightness);
    vec3 majorColor = vec3(1.0);

    vec3 color = mix(bg, lineColor, line);
    color = mix(color, majorColor, major);

    // --- green pulse ring ---
    if (uPulse.w > 0.5) {
      float dist     = length(vWorldPos - uPulse.xy);
      float radius   = uPulse.z * 180.0;          // expands at 180 world-units/sec
      float ringW    = 14.0;
      float ring     = smoothstep(ringW, 0., abs(dist - radius));
      float fade     = 1.0 - smoothstep(1.8, 3.2, uPulse.z);  // fades over ~3s
      float glow     = ring * fade;

      vec3 green = vec3(0.47, 0.71, 0.35);
      // tint only where there are lines; bg stays dark
      color = mix(color, green, glow * clamp(line + major, 0., 1.) * 0.95);
      // subtle green ambient inside the ring
      float fill = smoothstep(0., ringW * 2., radius - dist) * fade * 0.12;
      color = mix(color, green, fill * clamp(line + major, 0., 1.));
    }

    gl_FragColor = vec4(color, 1.0);
  }
`

onMounted(() => {
  const el = canvas.value
  if (!el) return

  const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(el.clientWidth, el.clientHeight)

  const scene  = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(55, el.clientWidth / el.clientHeight, 0.1, 500)
  camera.position.set(0, 0, 110)
  camera.lookAt(0, 0, 0)

  const uTime  = { value: 0 }
  const uMouse = { value: new THREE.Vector2(0, 0) }
  const uPulse = { value: new THREE.Vector4(0, 0, 0, 0) }

  // convert screen px → three.js world XY (camera looking straight down)
  const screenToWorld = (sx: number, sy: number) => {
    const w = el.clientWidth, h = el.clientHeight
    const vFov = camera.fov * Math.PI / 180
    const visH = 2 * Math.tan(vFov / 2) * camera.position.z
    const visW = visH * (w / h)
    return new THREE.Vector2(
      (sx / w - 0.5) * visW,
      -(sy / h - 0.5) * visH,
    )
  }

  let pulseStart = 0
  const triggerPulse = (sx: number, sy: number) => {
    const wp = screenToWorld(sx, sy)
    uPulse.value.x = wp.x
    uPulse.value.y = wp.y
    uPulse.value.z = 0
    uPulse.value.w = 1
    pulseStart = performance.now() / 1000
  }

  // watch prop from parent
  watch(() => props.pulseTrigger, (val) => {
    if (val) triggerPulse(val.x, val.y)
  })

  const segsForSize = (w: number, h: number) =>
    Math.min(Math.ceil(Math.max(w, h) / 1.8), 1200)

  let geo = new THREE.PlaneGeometry(400, 400, segsForSize(el.clientWidth, el.clientHeight), segsForSize(el.clientWidth, el.clientHeight))
  const mat = new THREE.ShaderMaterial({
    vertexShader:   VERT,
    fragmentShader: FRAG,
    uniforms: { uTime, uMouse, uPulse },
  })
  const mesh = new THREE.Mesh(geo, mat)
  scene.add(mesh)

  let tx = 0, ty = 0
  const onMouse = (e: MouseEvent) => {
    tx = (e.clientX / window.innerWidth  - 0.5) * 1.5
    ty = (e.clientY / window.innerHeight - 0.5) * 1.5
  }
  window.addEventListener('mousemove', onMouse)

  let resizeTimer: ReturnType<typeof setTimeout>
  const onResize = () => {
    const w = el.clientWidth, h = el.clientHeight
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      const segs = segsForSize(w, h)
      geo.dispose()
      geo = new THREE.PlaneGeometry(400, 400, segs, segs)
      mesh.geometry = geo
    }, 200)
  }
  window.addEventListener('resize', onResize)

  let rafId: number
  const startTime = performance.now()

  const animate = () => {
    rafId = requestAnimationFrame(animate)
    const now = performance.now() / 1000
    uTime.value  = now - startTime / 1000
    uMouse.value.x += (tx - uMouse.value.x) * 0.015
    uMouse.value.y += (ty - uMouse.value.y) * 0.015

    if (uPulse.value.w > 0.5) {
      uPulse.value.z = now - pulseStart
      if (uPulse.value.z > 3.5) uPulse.value.w = 0
    }

    renderer.render(scene, camera)
  }
  animate()

  onUnmounted(() => {
    cancelAnimationFrame(rafId)
    clearTimeout(resizeTimer)
    window.removeEventListener('mousemove', onMouse)
    window.removeEventListener('resize', onResize)
    renderer.dispose()
    geo.dispose()
    mat.dispose()
  })
})
</script>

<style scoped>
.three-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
