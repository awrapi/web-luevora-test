import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls } from '@react-three/drei';

/**
 * Model3D — loads a GLB and auto-rotates slowly on Y axis
 */
const Model3D = ({ url, speed = 0.005 }) => {
  const { scene } = useGLTF(url);
  const ref = useRef();

  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.y += speed;
    }
  });

  return <primitive ref={ref} object={scene} scale={1} />;
};

/**
 * CopilotModel3D
 * Renders a GLB model inside a Canvas of a given size.
 * Falls back to nothing while loading.
 *
 * Props:
 *   url    — path to GLB, e.g. "/models/copilot.glb"
 *   size   — pixel size of the square canvas (default 40)
 *   speed  — rotation speed per frame (default 0.005)
 */
const CopilotModel3D = ({ url = '/models/copilot.glb', size = 40, speed = 0.005 }) => {
  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 2.5], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* Lights */}
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 5, 5]} intensity={1.5} />
        <directionalLight position={[-3, -2, -5]} intensity={0.4} />

        <Suspense fallback={null}>
          <Model3D url={url} speed={speed} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default CopilotModel3D;
