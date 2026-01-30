import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// --- 물리 상수 ---
const MU_SUN = 1.32712440018e20;
const AU_TO_M = 149597870700;
const DAY_TO_S = 86400;

// 가속도 계산 (기존 로직 유지)
function orbital_dynamics_r(r_vec) {
  const r_sq = r_vec[0] ** 2 + r_vec[1] ** 2 + r_vec[2] ** 2;
  const r = Math.sqrt(r_sq);
  return r_vec.map(val => -(MU_SUN / (r_sq * r)) * val);
}

// 심플렉트 적분 (기존 로직 유지)
function symplectic_step(Y, dt) {
  let R_prev = Y.slice(0, 3);
  let V_prev = Y.slice(3, 6);
  const A_prev = orbital_dynamics_r(R_prev);
  const V_half = V_prev.map((v, i) => v + 0.5 * A_prev[i] * dt);
  const R_next = R_prev.map((r, i) => r + V_half[i] * dt);
  const A_next = orbital_dynamics_r(R_next);
  const V_next = V_half.map((v, i) => v + 0.5 * A_next[i] * dt);
  return [...R_next, ...V_next];
}

export default function SolarSystem3D() {
  const mountRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [timeScale, setTimeScale] = useState(100000); // 3D에서는 빠른 움직임 관찰을 위해 높게 설정

  // 행성 데이터 (제공해주신 데이터 기반)
  const planetData = [
    { name: '수성', nameEn: 'Mercury', color: 0x8c7853, size: 0.8, initialState: [4.91225e10, -3.95155e10, -7.02633e9, 3.48316e4, 4.09539e4, 2.76008e3], rot: 58.6 },
    { name: '금성', nameEn: 'Venus', color: 0xffc649, size: 1.2, initialState: [-3.49841e10, -9.62386e10, -2.57004e9, 3.27914e4, -1.18944e4, -1.97059e3], rot: -243 },
    { name: '지구', nameEn: 'Earth', color: 0x4a90e2, size: 1.3, initialState: [-1.13988e11, -9.00639e10, 1.83944e6, 2.14668e4, -2.69850e4, -3.99201e-1], rot: 1 },
    { name: '화성', nameEn: 'Mars', color: 0xe27b58, size: 0.9, initialState: [-3.05355e11, 8.44825e10, -6.64901e9, -5.98991e3, -2.00030e4, -4.51061e2], rot: 1.026 },
    // 목성 이상은 거리가 너무 멀어 화면 구성을 위해 거리 스케일링 필요
  ];

  // 물리 상태 관리 Ref
  const statesRef = useRef({});
  const meshesRef = useRef({});

  useEffect(() => {
    // 1. Scene 설정
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000005);

    // 2. 카메라 설정
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 50, 100);

    // 3. 렌더러 설정
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    // 4. 조명 설정
    const sunLight = new THREE.PointLight(0xffffff, 2, 1000); // 태양 빛
    scene.add(sunLight);
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5); // 우주 배경광
    scene.add(ambientLight);

    // 5. 태양 생성
    const sunGeo = new THREE.SphereGeometry(5, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sun);

    // 6. 행성 생성 및 초기 상태 설정
    const textureLoader = new THREE.TextureLoader();
    planetData.forEach(p => {
      const geo = new THREE.SphereGeometry(p.size, 32, 32);
      const mat = new THREE.MeshStandardMaterial({ color: p.color });
      const mesh = new THREE.Mesh(geo, mat);
      
      scene.add(mesh);
      meshesRef.current[p.nameEn] = mesh;
      statesRef.current[p.nameEn] = [...p.initialState];

      // 궤도 라인 (선택 사항)
      const points = [];
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(points);
      const orbitMat = new THREE.LineBasicMaterial({ color: p.color, transparent: true, opacity: 0.3 });
      const orbitLine = new THREE.Line(orbitGeo, orbitMat);
      scene.add(orbitLine);
    });

    // 7. 컨트롤
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // 8. 애니메이션 루프
    let lastTime = Date.now();
    const animate = () => {
      requestAnimationFrame(animate);
      
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (isPlaying) {
        const effectiveDt = dt * timeScale;
        
        planetData.forEach(p => {
          // 물리 업데이트
          const currentState = statesRef.current[p.nameEn];
          const nextState = symplectic_step(currentState, effectiveDt);
          statesRef.current[p.nameEn] = nextState;

          // 3D 좌표 변환 (거리 축소 스케일 적용: 10^9 나눔)
          const scale = 1e9;
          const mesh = meshesRef.current[p.nameEn];
          mesh.position.set(nextState[0] / scale, nextState[2] / scale, nextState[1] / scale);
          
          // 자전
          mesh.rotation.y += (2 * Math.PI / (p.rot * DAY_TO_S)) * effectiveDt;
        });
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // 클린업
    return () => {
      mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      
      {/* UI 레이어 */}
      <div style={{ position: 'absolute', top: 20, left: 20, color: 'white', background: 'rgba(0,0,0,0.5)', padding: '15px', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>3D 심플렉트 태양계</h2>
        <div style={{ marginTop: '10px' }}>
          <button onClick={() => setIsPlaying(!isPlaying)} style={{ padding: '5px 15px', marginRight: '10px' }}>
            {isPlaying ? '일시정지' : '재생'}
          </button>
          <input 
            type="range" min="1000" max="1000000" step="1000" 
            value={timeScale} onChange={(e) => setTimeScale(Number(e.target.value))} 
          />
          <span style={{ marginLeft: '10px' }}>속도: {timeScale}x</span>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '10px' }}>마우스 드래그: 회전 | 휠: 확대/축소</p>
      </div>
    </div>
  );
}
    
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 30, 50);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
      canvas: canvasRef.current, 
      antialias: true,
      alpha: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // 별 배경 생성
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 15000;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      const radius = 200 + Math.random() * 300;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i3 + 2] = radius * Math.cos(phi);
      
      const colorVariant = Math.random();
      if (colorVariant < 0.1) {
        starColors[i3] = 1.0;
        starColors[i3 + 1] = 0.7;
        starColors[i3 + 2] = 0.5;
      } else if (colorVariant < 0.2) {
        starColors[i3] = 0.5;
        starColors[i3 + 1] = 0.7;
        starColors[i3 + 2] = 1.0;
      } else {
        starColors[i3] = 1.0;
        starColors[i3 + 1] = 1.0;
        starColors[i3 + 2] = 1.0;
      }
      
      starSizes[i] = Math.random() * 2 + 0.5;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

    const starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float time;
        
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float twinkle = sin(time * 2.0 + position.x * 0.1) * 0.5 + 0.5;
          gl_PointSize = size * (300.0 / -mvPosition.z) * (0.5 + twinkle * 0.5);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // 네뷸라 효과
    const nebulaGeometry = new THREE.SphereGeometry(400, 32, 32);
    const nebulaMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color1: { value: new THREE.Color(0x1a0033) },
        color2: { value: new THREE.Color(0x330066) },
        color3: { value: new THREE.Color(0x000033) }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        
        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color1;
        uniform vec3 color2;
        uniform vec3 color3;
        varying vec2 vUv;
        varying vec3 vPosition;
        
        float noise(vec3 p) {
          return fract(sin(dot(p, vec3(12.9898, 78.233, 45.5432))) * 43758.5453);
        }
        
        void main() {
          vec3 p = vPosition * 0.01;
          float n = noise(p + time * 0.05);
          n += 0.5 * noise(p * 2.0 + time * 0.07);
          n += 0.25 * noise(p * 4.0 + time * 0.09);
          
          vec3 color = mix(color1, color2, n);
          color = mix(color, color3, sin(vUv.y * 3.14159) * 0.5);
          
          float alpha = n * 0.15;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false
    });

    const nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
    scene.add(nebula);

    // 태양 생성 (커스텀 쉐이더)
    const sunGeometry = new THREE.SphereGeometry(3, 64, 64);
    const sunMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color1: { value: new THREE.Color(0xffa500) },
        color2: { value: new THREE.Color(0xff4500) },
        color3: { value: new THREE.Color(0xffff00) }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        uniform float time;
        
        float noise(vec3 p) {
          return fract(sin(dot(p, vec3(12.9898, 78.233, 45.5432))) * 43758.5453);
        }
        
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          
          vec3 pos = position;
          float displacement = noise(pos * 2.0 + time) * 0.15;
          displacement += noise(pos * 4.0 + time * 1.5) * 0.08;
          pos += normal * displacement;
          
          vPosition = pos;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color1;
        uniform vec3 color2;
        uniform vec3 color3;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        float noise(vec3 p) {
          return fract(sin(dot(p, vec3(12.9898, 78.233, 45.5432))) * 43758.5453);
        }
        
        void main() {
          float n = noise(vPosition * 3.0 + time * 0.5);
          n += 0.5 * noise(vPosition * 6.0 + time * 0.7);
          n += 0.25 * noise(vPosition * 12.0 + time);
          
          vec3 color = mix(color1, color2, n);
          color = mix(color, color3, sin(n * 6.28) * 0.5 + 0.5);
          
          float fresnel = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          color += fresnel * 0.5;
          
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });

    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);

    // 태양 글로우 효과
    const glowGeometry = new THREE.SphereGeometry(4.5, 32, 32);
    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        glowColor: { value: new THREE.Color(0xffa500) }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float time;
        varying vec3 vNormal;
        
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          intensity *= (sin(time * 2.0) * 0.1 + 0.9);
          gl_FragColor = vec4(glowColor, intensity * 0.8);
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glow);

    // 행성들 생성
    const planets = [];
    planetData.forEach((data, index) => {
      const geometry = new THREE.SphereGeometry(data.size, 32, 32);
      const material = new THREE.MeshStandardMaterial({ 
        color: data.color,
        metalness: 0.3,
        roughness: 0.7,
        emissive: data.color,
        emissiveIntensity: 0.2
      });
      const planet = new THREE.Mesh(geometry, material);
      
      planet.userData = {
        ...data,
        angle: Math.random() * Math.PI * 2,
        index
      };
      
      scene.add(planet);
      planets.push(planet);

      // 궤도선
      const orbitGeometry = new THREE.BufferGeometry();
      const orbitPoints = [];
      for (let i = 0; i <= 128; i++) {
        const angle = (i / 128) * Math.PI * 2;
        orbitPoints.push(
          Math.cos(angle) * data.distance,
          0,
          Math.sin(angle) * data.distance
        );
      }
      orbitGeometry.setAttribute('position', new THREE.Float32BufferAttribute(orbitPoints, 3));
      const orbitMaterial = new THREE.LineBasicMaterial({ 
        color: 0x444444, 
        transparent: true, 
        opacity: 0.3 
      });
      const orbit = new THREE.Line(orbitGeometry, orbitMaterial);
      scene.add(orbit);
    });

    planetsRef.current = planets;

    // 조명
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const sunLight = new THREE.PointLight(0xffffff, 2, 200);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);

    // 마우스 컨트롤
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let cameraRotation = { x: 0, y: 0 };
    let targetCameraPosition = null;
    let targetLookAt = null;

    const onMouseDown = (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      
      cameraRotation.y += deltaX * 0.005;
      cameraRotation.x += deltaY * 0.005;
      
      cameraRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraRotation.x));
      
      previousMousePosition = { x: e.clientX, y: e.clientY };
      
      targetCameraPosition = null;
      targetLookAt = null;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e) => {
      const currentDistance = camera.position.length();
      const newDistance = currentDistance + e.deltaY * 0.05;
      const clampedDistance = Math.max(10, Math.min(100, newDistance));
      
      camera.position.normalize().multiplyScalar(clampedDistance);
      
      targetCameraPosition = null;
      targetLookAt = null;
    };

    const onClick = (e) => {
      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(planets);
      
      if (intersects.length > 0) {
        const planet = intersects[0].object;
        setSelectedPlanet(planet.userData);
        
        const distance = planet.userData.size * 4;
        targetCameraPosition = new THREE.Vector3(
          planet.position.x + distance,
          planet.position.y + distance * 0.5,
          planet.position.z + distance
        );
        targetLookAt = planet.position.clone();
      } else {
        setSelectedPlanet(null);
      }
    };

    canvasRef.current.addEventListener('mousedown', onMouseDown);
    canvasRef.current.addEventListener('mousemove', onMouseMove);
    canvasRef.current.addEventListener('mouseup', onMouseUp);
    canvasRef.current.addEventListener('wheel', onWheel);
    canvasRef.current.addEventListener('click', onClick);

    // 애니메이션
    let animationId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // 별 반짝임
      starMaterial.uniforms.time.value = time;
      
      // 네뷸라 애니메이션
      nebulaMaterial.uniforms.time.value = time;

      // 태양 애니메이션
      sunMaterial.uniforms.time.value = time;
      glowMaterial.uniforms.time.value = time;
      sun.rotation.y += 0.001;

      // 행성 공전
      planets.forEach((planet) => {
        planet.userData.angle += planet.userData.speed * 0.0005;
        planet.position.x = Math.cos(planet.userData.angle) * planet.userData.distance;
        planet.position.z = Math.sin(planet.userData.angle) * planet.userData.distance;
        planet.rotation.y += 0.01;
      });

      // 카메라 부드러운 이동
      if (targetCameraPosition && targetLookAt) {
        camera.position.lerp(targetCameraPosition, 0.05);
        
        const currentLookAt = new THREE.Vector3();
        camera.getWorldDirection(currentLookAt);
        currentLookAt.multiplyScalar(10).add(camera.position);
        currentLookAt.lerp(targetLookAt, 0.05);
        camera.lookAt(currentLookAt);
        
        if (camera.position.distanceTo(targetCameraPosition) < 0.1) {
          targetCameraPosition = null;
          targetLookAt = null;
        }
      } else {
        const radius = camera.position.length();
        camera.position.x = radius * Math.sin(cameraRotation.y) * Math.cos(cameraRotation.x);
        camera.position.y = radius * Math.sin(cameraRotation.x);
        camera.position.z = radius * Math.cos(cameraRotation.y) * Math.cos(cameraRotation.x);
        camera.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
    };

    animate();

    // 리사이즈 핸들러
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // 클린업
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      canvasRef.current?.removeEventListener('mousedown', onMouseDown);
      canvasRef.current?.removeEventListener('mousemove', onMouseMove);
      canvasRef.current?.removeEventListener('mouseup', onMouseUp);
      canvasRef.current?.removeEventListener('wheel', onWheel);
      canvasRef.current?.removeEventListener('click', onClick);
      renderer.dispose();
    };
  }, []);

  // Gemini API 챗봇
  const sendMessage = async () => {
    if (!chatInput.trim() || !geminiApiKey) return;

    const userMessage = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `당신은 우주와 천문학 전문가입니다. 다음 질문에 친절하고 자세하게 답변해주세요: ${userMessage}`
            }]
          }]
        })
      });

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '죄송합니다. 답변을 생성할 수 없습니다.';
      
      setChatMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '오류가 발생했습니다. API 키를 확인해주세요.' }]);
    }
  };

  // 음악 재생
  const toggleMusic = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio('https://cdn.pixabay.com/download/audio/2022/03/10/audio_4d6d2f4c58.mp3');
      audioRef.current.loop = true;
      audioRef.current.volume = 0.3;
    }
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      overflow: 'hidden', 
      position: 'relative',
      fontFamily: '"Orbitron", "Space Mono", monospace',
      background: '#000'
    }}>
      <canvas ref={canvasRef} />
      
      {/* 제목 */}
      <div style={{
        position: 'absolute',
        top: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
        padding: '20px 50px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        zIndex: 10
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '32px',
          fontWeight: '700',
          background: 'linear-gradient(135deg, #ffffff 0%, #a0c4ff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '3px',
          textTransform: 'uppercase'
        }}>
          Solar System Explorer
        </h1>
      </div>

      {/* 행성 정보 패널 */}
      {selectedPlanet && (
        <div style={{
          position: 'absolute',
          top: '120px',
          left: '30px',
          width: '350px',
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(25px)',
          WebkitBackdropFilter: 'blur(25px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '24px',
          padding: '30px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
          animation: 'slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 10
        }}>
          <button
            onClick={() => setSelectedPlanet(null)}
            style={{
              position: 'absolute',
              top: '15px',
              right: '15px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: '#fff',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.2)';
              e.target.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.1)';
              e.target.style.transform = 'scale(1)';
            }}
          >
            ×
          </button>
          
          <h2 style={{
            margin: '0 0 10px 0',
            fontSize: '28px',
            fontWeight: '700',
            color: '#fff',
            letterSpacing: '1px'
          }}>
            {selectedPlanet.name}
          </h2>
          
          <p style={{
            margin: '0 0 20px 0',
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.6)',
            textTransform: 'uppercase',
            letterSpacing: '2px'
          }}>
            {selectedPlanet.nameEn}
          </p>
          
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ marginBottom: '15px' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px' }}>크기 (지구 대비)</span>
              <div style={{
                marginTop: '5px',
                fontSize: '20px',
                fontWeight: '600',
                color: '#fff'
              }}>
                {selectedPlanet.size.toFixed(2)}×
              </div>
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px' }}>거리 (상대적)</span>
              <div style={{
                marginTop: '5px',
                fontSize: '20px',
                fontWeight: '600',
                color: '#fff'
              }}>
                {selectedPlanet.distance} AU
              </div>
            </div>
            
            <div>
              <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px' }}>공전 속도</span>
              <div style={{
                marginTop: '5px',
                fontSize: '20px',
                fontWeight: '600',
                color: '#fff'
              }}>
                {selectedPlanet.speed} km/s
              </div>
            </div>
          </div>
          
          <p style={{
            margin: 0,
            fontSize: '14px',
            lineHeight: '1.6',
            color: 'rgba(255, 255, 255, 0.8)'
          }}>
            {selectedPlanet.info}
          </p>
        </div>
      )}

      {/* API 키 입력 */}
      {showApiInput && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(25px)',
          WebkitBackdropFilter: 'blur(25px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '24px',
          padding: '40px',
          width: '90%',
          maxWidth: '500px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          zIndex: 1000
        }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#fff', fontSize: '24px' }}>
            Gemini API 키 입력
          </h3>
          <p style={{ margin: '0 0 20px 0', color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>
            우주 챗봇 기능을 사용하려면 Gemini API 키가 필요합니다.
            <br />
            <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" 
               style={{ color: '#a0c4ff', textDecoration: 'none' }}>
              여기서 무료로 발급받기
            </a>
          </p>
          <input
            type="text"
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            placeholder="API 키를 입력하세요"
            style={{
              width: '100%',
              padding: '15px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '14px',
              marginBottom: '20px',
              boxSizing: 'border-box'
            }}
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                if (geminiApiKey) setShowApiInput(false);
              }}
              style={{
                flex: 1,
                padding: '15px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            >
              시작하기
            </button>
            <button
              onClick={() => setShowApiInput(false)}
              style={{
                padding: '15px 25px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              건너뛰기
            </button>
          </div>
        </div>
      )}

      {/* 챗봇 버튼 */}
      {!showApiInput && (
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          style={{
            position: 'absolute',
            bottom: '30px',
            right: '30px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            color: '#fff',
            fontSize: '28px',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
            transition: 'all 0.3s ease',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'scale(1.1)';
            e.target.style.boxShadow = '0 6px 30px rgba(102, 126, 234, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1)';
            e.target.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.4)';
          }}
        >
          💬
        </button>
      )}

      {/* 챗봇 패널 */}
      {isChatOpen && (
        <div style={{
          position: 'absolute',
          bottom: '110px',
          right: '30px',
          width: '400px',
          height: '500px',
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(25px)',
          WebkitBackdropFilter: 'blur(25px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '24px',
          padding: '25px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 99,
          animation: 'slideUp 0.3s ease'
        }}>
          <h3 style={{
            margin: '0 0 20px 0',
            color: '#fff',
            fontSize: '20px',
            fontWeight: '600'
          }}>
            🌌 우주 가이드
          </h3>
          
          <div style={{
            flex: 1,
            overflowY: 'auto',
            marginBottom: '15px',
            paddingRight: '10px'
          }}>
            {chatMessages.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 0.5)',
                padding: '40px 20px',
                fontSize: '14px'
              }}>
                우주와 천문학에 대해 무엇이든 물어보세요!
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div key={idx} style={{
                  marginBottom: '15px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: msg.role === 'user' 
                    ? 'rgba(102, 126, 234, 0.2)' 
                    : 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  {msg.content}
                </div>
              ))
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="메시지를 입력하세요..."
              style={{
                flex: 1,
                padding: '12px 16px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <button
              onClick={sendMessage}
              style={{
                padding: '12px 20px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* 음악 플레이어 */}
      <button
        onClick={toggleMusic}
        style={{
          position: 'absolute',
          bottom: '30px',
          left: '30px',
          padding: '15px 25px',
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(25px)',
          WebkitBackdropFilter: 'blur(25px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '50px',
          color: '#fff',
          fontSize: '16px',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s ease',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.12)';
          e.target.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.08)';
          e.target.style.transform = 'translateY(0)';
        }}
      >
        {isPlaying ? '⏸' : '▶'} Space Music
      </button>

      {/* 조작 가이드 */}
      <div style={{
        position: 'absolute',
        top: '120px',
        right: '30px',
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '20px',
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: '13px',
        lineHeight: '1.8',
        zIndex: 10
      }}>
        <div style={{ marginBottom: '8px', color: '#fff', fontWeight: '600' }}>⌨️ 조작법</div>
        <div>🖱️ 드래그: 회전</div>
        <div>🔍 스크롤: 줌</div>
        <div>👆 클릭: 행성 선택</div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap');
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        
        ::-webkit-scrollbar {
          width: 6px;
        }
        
        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
}
