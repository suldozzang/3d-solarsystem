import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// 태양계 시뮬레이션 컴포넌트
export default function SolarSystemSimulation() {
  const canvasRef = useRef(null);
  const [selectedPlanet, setSelectedPlanet] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showApiInput, setShowApiInput] = useState(true);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const planetsRef = useRef([]);
  const audioRef = useRef(null);

  // 행성 데이터
  const planetData = [
    { name: '수성', nameEn: 'Mercury', size: 0.383, distance: 5, color: 0x8c7853, speed: 4.74, info: '태양에 가장 가까운 행성으로 표면 온도가 극심하게 변합니다.' },
    { name: '금성', nameEn: 'Venus', size: 0.949, distance: 7, color: 0xffc649, speed: 3.50, info: '태양계에서 가장 뜨거운 행성이며 두꺼운 대기를 가지고 있습니다.' },
    { name: '지구', nameEn: 'Earth', size: 1.0, distance: 10, color: 0x4169e1, speed: 2.98, info: '우리가 사는 푸른 행성이며 생명체가 존재하는 유일한 행성입니다.' },
    { name: '화성', nameEn: 'Mars', size: 0.532, distance: 13, color: 0xcd5c5c, speed: 2.41, info: '붉은 행성으로 불리며 미래 인류 이주 후보지입니다.' },
    { name: '목성', nameEn: 'Jupiter', size: 2.5, distance: 20, color: 0xdaa520, speed: 1.31, info: '태양계에서 가장 큰 행성이며 대적점이 유명합니다.' },
    { name: '토성', nameEn: 'Saturn', size: 2.2, distance: 28, color: 0xf4a460, speed: 0.97, info: '아름다운 고리를 가진 행성입니다.' },
    { name: '천왕성', nameEn: 'Uranus', size: 1.6, distance: 36, color: 0x4fd0e7, speed: 0.68, info: '옆으로 누워서 공전하는 독특한 행성입니다.' },
    { name: '해왕성', nameEn: 'Neptune', size: 1.55, distance: 44, color: 0x4169e1, speed: 0.54, info: '태양계에서 가장 먼 행성이며 강력한 바람이 붑니다.' }
  ];

  useEffect(() => {
    if (!canvasRef.current) return;

    // Three.js 씬 설정
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
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
