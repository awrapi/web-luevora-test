import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const Feature3DPreview = ({ featureId }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 240;
    const height = container.clientHeight || 160;

    // Scene
    const scene = new THREE.Scene();
    
    // Background colors matching card themes
    const bgColors = {
      14: 0xe0f2fe,
      15: 0xcff4fc,
      16: 0xfef3c7,
      17: 0xe0f2fe,
    };
    scene.background = new THREE.Color(bgColors[featureId] || 0xf8fafc);

    // Camera (Isometric perspective)
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
    camera.position.set(4, 3.5, 5);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    container.appendChild(renderer.domElement);

    // Studio Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xa5b4fc, 0.6);
    fillLight.position.set(-5, 3, -3);
    scene.add(fillLight);

    // Common Clay Material Helper
    const createClayMaterial = (color, roughness = 0.35, metalness = 0.05) => {
      return new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        flatShading: false,
      });
    };

    // Shadow Floor
    const shadowPlaneGeo = new THREE.PlaneGeometry(12, 12);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.12 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.0;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Group for animation
    const animatedGroup = new THREE.Group();
    scene.add(animatedGroup);

    // Build 3D Scene Geometry per Feature ID
    if (featureId === 14) {
      // --- Feature 14: Bring Your Old Data ---
      // Database Base Cylinder
      const dbBaseGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.5, 32);
      const dbBaseMat = createClayMaterial(0x0284c7);
      const dbBase = new THREE.Mesh(dbBaseGeo, dbBaseMat);
      dbBase.position.y = -0.6;
      dbBase.castShadow = true;
      dbBase.receiveShadow = true;
      animatedGroup.add(dbBase);

      const dbCapGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.1, 32);
      const dbCapMat = createClayMaterial(0x38bdf8);
      const dbCap = new THREE.Mesh(dbCapGeo, dbCapMat);
      dbCap.position.y = -0.32;
      animatedGroup.add(dbCap);

      // PDF Slab
      const pdfGeo = new THREE.BoxGeometry(0.7, 0.9, 0.08);
      const pdfMat = createClayMaterial(0xffffff);
      const pdfMesh = new THREE.Mesh(pdfGeo, pdfMat);
      pdfMesh.position.set(-0.8, 0.4, 0.2);
      pdfMesh.rotation.set(0.1, 0.3, -0.15);
      pdfMesh.castShadow = true;
      animatedGroup.add(pdfMesh);

      // PDF Header Tag
      const pdfTagGeo = new THREE.BoxGeometry(0.5, 0.12, 0.09);
      const pdfTagMat = createClayMaterial(0xef4444);
      const pdfTag = new THREE.Mesh(pdfTagGeo, pdfTagMat);
      pdfTag.position.set(-0.8, 0.72, 0.21);
      pdfTag.rotation.set(0.1, 0.3, -0.15);
      animatedGroup.add(pdfTag);

      // XLS Slab
      const xlsGeo = new THREE.BoxGeometry(0.7, 0.9, 0.08);
      const xlsMat = createClayMaterial(0xffffff);
      const xlsMesh = new THREE.Mesh(xlsGeo, xlsMat);
      xlsMesh.position.set(0.8, 0.4, -0.2);
      xlsMesh.rotation.set(-0.1, -0.3, 0.15);
      xlsMesh.castShadow = true;
      animatedGroup.add(xlsMesh);

      // XLS Header Tag
      const xlsTagGeo = new THREE.BoxGeometry(0.5, 0.12, 0.09);
      const xlsTagMat = createClayMaterial(0x10b981);
      const xlsTag = new THREE.Mesh(xlsTagGeo, xlsTagMat);
      xlsTag.position.set(0.8, 0.72, -0.19);
      xlsTag.rotation.set(-0.1, -0.3, 0.15);
      animatedGroup.add(xlsTag);

      // Central Sync Sphere
      const syncGeo = new THREE.SphereGeometry(0.25, 24, 24);
      const syncMat = createClayMaterial(0x10b981);
      const syncMesh = new THREE.Mesh(syncGeo, syncMat);
      syncMesh.position.set(0, 0.2, 0);
      syncMesh.castShadow = true;
      animatedGroup.add(syncMesh);

    } else if (featureId === 15) {
      // --- Feature 15: Interactive Copilot ---
      // Console Dark Window
      const winGeo = new THREE.BoxGeometry(2.2, 1.4, 0.15);
      const winMat = createClayMaterial(0x0f172a, 0.2, 0.1);
      const winMesh = new THREE.Mesh(winGeo, winMat);
      winMesh.position.set(0, 0, 0);
      winMesh.castShadow = true;
      animatedGroup.add(winMesh);

      // Control Dots
      const dotGeo = new THREE.SphereGeometry(0.06, 16, 16);
      const dot1 = new THREE.Mesh(dotGeo, createClayMaterial(0xef4444));
      dot1.position.set(-0.85, 0.5, 0.09);
      animatedGroup.add(dot1);

      const dot2 = new THREE.Mesh(dotGeo, createClayMaterial(0xf59e0b));
      dot2.position.set(-0.68, 0.5, 0.09);
      animatedGroup.add(dot2);

      const dot3 = new THREE.Mesh(dotGeo, createClayMaterial(0x10b981));
      dot3.position.set(-0.51, 0.5, 0.09);
      animatedGroup.add(dot3);

      // Command Bar
      const cmdGeo = new THREE.BoxGeometry(1.6, 0.3, 0.08);
      const cmdMat = createClayMaterial(0x1e293b);
      const cmdMesh = new THREE.Mesh(cmdGeo, cmdMat);
      cmdMesh.position.set(0, 0.15, 0.1);
      animatedGroup.add(cmdMesh);

      // Result Bar
      const resGeo = new THREE.BoxGeometry(1.4, 0.32, 0.08);
      const resMat = createClayMaterial(0x065f46);
      const resMesh = new THREE.Mesh(resGeo, resMat);
      resMesh.position.set(-0.1, -0.28, 0.1);
      animatedGroup.add(resMesh);

      // Floating AI Sparkle
      const sparkGeo = new THREE.OctahedronGeometry(0.3, 0);
      const sparkMat = createClayMaterial(0x6366f1, 0.1, 0.3);
      const sparkMesh = new THREE.Mesh(sparkGeo, sparkMat);
      sparkMesh.position.set(1.1, 0.6, 0.3);
      sparkMesh.castShadow = true;
      animatedGroup.add(sparkMesh);

    } else if (featureId === 16) {
      // --- Feature 16: Human in the Loop ---
      // Golden Shield Base
      const shieldShape = new THREE.Shape();
      shieldShape.moveTo(0, 1.2);
      shieldShape.lineTo(0.9, 0.7);
      shieldShape.lineTo(0.9, -0.3);
      shieldShape.quadraticCurveTo(0, -1.3, 0, -1.3);
      shieldShape.quadraticCurveTo(-0.9, -0.3, -0.9, -0.3);
      shieldShape.lineTo(-0.9, 0.7);
      shieldShape.closePath();

      const extrudeSettings = { depth: 0.2, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.06, bevelThickness: 0.06 };
      const shieldGeo = new THREE.ExtrudeGeometry(shieldShape, extrudeSettings);
      const shieldMat = createClayMaterial(0xf59e0b, 0.3, 0.2);
      const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
      shieldMesh.position.set(0, 0, -0.1);
      shieldMesh.castShadow = true;
      animatedGroup.add(shieldMesh);

      // Inner White Card
      const cardGeo = new THREE.BoxGeometry(1.2, 0.8, 0.1);
      const cardMat = createClayMaterial(0xffffff);
      const cardMesh = new THREE.Mesh(cardGeo, cardMat);
      cardMesh.position.set(0, 0.05, 0.15);
      cardMesh.castShadow = true;
      animatedGroup.add(cardMesh);

      // Approve Button (Green)
      const appGeo = new THREE.BoxGeometry(0.45, 0.3, 0.1);
      const appMat = createClayMaterial(0x16a34a);
      const appMesh = new THREE.Mesh(appGeo, appMat);
      appMesh.position.set(-0.3, -0.1, 0.22);
      appMesh.castShadow = true;
      animatedGroup.add(appMesh);

      // Reject Button (Red)
      const rejGeo = new THREE.BoxGeometry(0.45, 0.3, 0.1);
      const rejMat = createClayMaterial(0xdc2626);
      const rejMesh = new THREE.Mesh(rejGeo, rejMat);
      rejMesh.position.set(0.3, -0.1, 0.22);
      rejMesh.castShadow = true;
      animatedGroup.add(rejMesh);

    } else if (featureId === 17) {
      // --- Feature 17: Telegram Smart Routing ---
      // Central Telegram Blue Orb
      const orbGeo = new THREE.SphereGeometry(0.7, 32, 32);
      const orbMat = createClayMaterial(0x0088cc, 0.2, 0.1);
      const orbMesh = new THREE.Mesh(orbGeo, orbMat);
      orbMesh.position.set(0, 0, 0);
      orbMesh.castShadow = true;
      animatedGroup.add(orbMesh);

      // Paper Plane Cone
      const planeGeo = new THREE.ConeGeometry(0.35, 0.8, 3);
      const planeMat = createClayMaterial(0xffffff);
      const planeMesh = new THREE.Mesh(planeGeo, planeMat);
      planeMesh.rotation.set(Math.PI / 4, 0, -Math.PI / 3);
      planeMesh.position.set(0.05, 0.05, 0.5);
      planeMesh.castShadow = true;
      animatedGroup.add(planeMesh);

      // Orbit Nodes
      const nodeGeo = new THREE.SphereGeometry(0.25, 24, 24);
      
      const n1 = new THREE.Mesh(nodeGeo, createClayMaterial(0x6366f1));
      n1.position.set(-1.4, 0.8, 0);
      n1.castShadow = true;
      animatedGroup.add(n1);

      const n2 = new THREE.Mesh(nodeGeo, createClayMaterial(0x10b981));
      n2.position.set(1.4, 0.8, 0);
      n2.castShadow = true;
      animatedGroup.add(n2);

      const n3 = new THREE.Mesh(nodeGeo, createClayMaterial(0xf59e0b));
      n3.position.set(0, -1.2, 0.3);
      n3.castShadow = true;
      animatedGroup.add(n3);
    }

    // Animation Loop
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Subtle float and rotation for high-end 3D feel
      animatedGroup.position.y = Math.sin(elapsedTime * 1.5) * 0.08;
      animatedGroup.rotation.y = Math.sin(elapsedTime * 0.8) * 0.12;

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [featureId]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: 160,
        position: 'relative',
        overflow: 'hidden',
        borderBottom: '1px solid #e2e8f0',
      }}
    />
  );
};

export default Feature3DPreview;
