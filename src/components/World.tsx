import { RigidBody } from '@react-three/rapier';
import { useTexture, Instance, Instances, Float } from '@react-three/drei';
import * as THREE from 'three';
import { useMemo } from 'react';

function Tree({ position, scale = 1, type = 'normal' }: { position: [number, number, number], scale?: number, type?: 'normal' | 'dead' }) {
  const isDead = type === 'dead';
  const lean = useMemo(() => (Math.random() - 0.5) * 0.2, []);
  
  return (
    <group position={position} scale={scale} rotation={[lean, Math.random() * Math.PI, lean]}>
      {/* Trunk - Twisted and textured look via geometry */}
      <RigidBody type="fixed" colliders="hull">
        <mesh castShadow receiveShadow position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.25, 0.4, 3, 7]} />
          <meshStandardMaterial color={isDead ? "#4e342e" : "#3e2723"} roughness={0.9} />
        </mesh>
      </RigidBody>
      
      {/* Branches - More complex structure */}
      <group position={[0, 3, 0]}>
        <mesh castShadow receiveShadow rotation={[0.5, 0, 0]} position={[0, 0.5, 0.2]}>
          <cylinderGeometry args={[0.1, 0.2, 1.5, 5]} />
          <meshStandardMaterial color={isDead ? "#4e342e" : "#3e2723"} />
        </mesh>
        <mesh castShadow receiveShadow rotation={[-0.4, 0.4, 0]} position={[-0.5, 0.2, -0.2]}>
          <cylinderGeometry args={[0.08, 0.18, 1.4, 5]} />
          <meshStandardMaterial color={isDead ? "#4e342e" : "#3e2723"} />
        </mesh>
        <mesh castShadow receiveShadow rotation={[0.2, -0.5, 0.3]} position={[0.5, 0.4, 0]}>
          <cylinderGeometry args={[0.09, 0.15, 1.3, 5]} />
          <meshStandardMaterial color={isDead ? "#4e342e" : "#3e2723"} />
        </mesh>
      </group>

       {/* Foliage - Clusters for better volume (Only if not dead) */}
       {!isDead && (
        <group position={[0, 4, 0]}>
            <mesh castShadow receiveShadow position={[0, 0, 0]} scale={1.2}>
            <dodecahedronGeometry args={[1]} />
            <meshStandardMaterial color="#2d5a27" roughness={0.8} />
            </mesh>
            <mesh castShadow receiveShadow position={[0.8, -0.5, 0.5]} scale={0.8}>
            <dodecahedronGeometry args={[1]} />
            <meshStandardMaterial color="#3a6b32" roughness={0.8} />
            </mesh>
            <mesh castShadow receiveShadow position={[-0.7, 0.2, -0.6]} scale={0.9}>
            <dodecahedronGeometry args={[1]} />
            <meshStandardMaterial color="#1e4620" roughness={0.8} />
            </mesh>
            <mesh castShadow receiveShadow position={[0.3, 0.8, -0.3]} scale={0.7}>
            <dodecahedronGeometry args={[1]} />
            <meshStandardMaterial color="#4a7c3a" roughness={0.8} />
            </mesh>
        </group>
       )}
    </group>
  );
}

function Rock({ position, scale = 1 }: { position: [number, number, number], scale?: number }) {
  // Create a composite rock from multiple shapes
  const rotation = useMemo(() => [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI] as [number, number, number], []);
  
  return (
    <RigidBody type="fixed" colliders="hull" position={position}>
      <group scale={scale} rotation={rotation}>
        {/* Main mass */}
        <mesh castShadow receiveShadow>
          <dodecahedronGeometry args={[1.5, 1]} /> {/* More detail */}
          <meshStandardMaterial color="#795548" roughness={0.8} flatShading />
        </mesh>
        {/* Detail chunks */}
        <mesh castShadow receiveShadow position={[1, -0.5, 0.5]} scale={0.6}>
          <dodecahedronGeometry args={[1.2, 0]} />
          <meshStandardMaterial color="#6d4c41" roughness={0.9} flatShading />
        </mesh>
        <mesh castShadow receiveShadow position={[-0.8, -0.8, -0.5]} scale={0.7}>
          <dodecahedronGeometry args={[1.1, 0]} />
          <meshStandardMaterial color="#5d4037" roughness={0.9} flatShading />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 1.2, 0]} scale={0.4}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#8d6e63" roughness={0.9} flatShading />
        </mesh>
        {/* Moss/Lichen patch */}
        <mesh position={[0.5, 0.5, 0.8]} scale={0.3}>
           <dodecahedronGeometry args={[1, 0]} />
           <meshStandardMaterial color="#556b2f" roughness={1} />
        </mesh>
      </group>
    </RigidBody>
  );
}

function Bush({ position, scale = 1, color = '#556b2f' }: { position: [number, number, number], scale?: number, color?: string }) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow receiveShadow position={[0, 0.3, 0]}>
        <dodecahedronGeometry args={[0.5]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.4, 0.2, 0.3]} scale={0.8}>
        <dodecahedronGeometry args={[0.5]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      <mesh castShadow receiveShadow position={[-0.3, 0.4, -0.2]} scale={0.7}>
        <dodecahedronGeometry args={[0.5]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
    </group>
  );
}

function Grass() {
  const count = 2000;
  const positions = useMemo(() => {
    const pos = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 48; 
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      pos.push({ x, z, scale: 0.5 + Math.random() * 0.8, rotation: Math.random() * Math.PI });
    }
    return pos;
  }, []);

  return (
    <Instances range={count}>
      <planeGeometry args={[0.15, 0.6]} />
      <meshStandardMaterial color="#556b2f" side={THREE.DoubleSide} />
      {positions.map((p, i) => (
        <Instance
          key={i}
          position={[p.x, -1.7, p.z]} // Adjusted to sit on ground at -2
          scale={[p.scale, p.scale, p.scale]}
          rotation={[0, p.rotation, 0]}
        />
      ))}
    </Instances>
  );
}

function SmallStones() {
  const count = 500;
  const positions = useMemo(() => {
    const pos = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 48; 
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      pos.push({ x, z, scale: 0.1 + Math.random() * 0.2, rotation: Math.random() * Math.PI });
    }
    return pos;
  }, []);

  return (
    <Instances range={count}>
      <dodecahedronGeometry args={[0.5, 0]} />
      <meshStandardMaterial color="#5d4037" roughness={0.9} />
      {positions.map((p, i) => (
        <Instance
          key={i}
          position={[p.x, -1.95, p.z]} // Adjusted to sit on ground at -2
          scale={[p.scale, p.scale * 0.6, p.scale]}
          rotation={[Math.random(), p.rotation, Math.random()]}
        />
      ))}
    </Instances>
  );
}

function Hills() {
  return (
    <group>
      {/* Distant Hills - Ring around the map */}
      <mesh position={[-60, -5, -60]} scale={[40, 20, 40]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#5d4037" roughness={1} />
      </mesh>
      <mesh position={[0, -10, -80]} scale={[60, 25, 40]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#4e342e" roughness={1} />
      </mesh>
      <mesh position={[60, -5, -60]} scale={[40, 20, 40]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#5d4037" roughness={1} />
      </mesh>
       <mesh position={[80, -5, 0]} scale={[40, 25, 50]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#4e342e" roughness={1} />
      </mesh>
       <mesh position={[60, -5, 60]} scale={[40, 20, 40]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#5d4037" roughness={1} />
      </mesh>
      <mesh position={[0, -10, 80]} scale={[60, 25, 40]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#4e342e" roughness={1} />
      </mesh>
       <mesh position={[-60, -5, 60]} scale={[40, 20, 40]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#5d4037" roughness={1} />
      </mesh>
      <mesh position={[-80, -5, 0]} scale={[40, 25, 50]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#4e342e" roughness={1} />
      </mesh>
    </group>
  );
}

export function World() {
  // Load texture - Rocky/Sandy Ground - Darker
  const texture = useTexture('https://picsum.photos/seed/darkground/1024/1024');
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(20, 20);

  // Procedural Generation
  const trees = useMemo(() => {
      const items = [];
      for (let i = 0; i < 30; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 15 + Math.random() * 30; // Spread out
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const scale = 0.8 + Math.random() * 0.8;
          const type = Math.random() > 0.8 ? 'dead' : 'normal';
          items.push({ position: [x, -2, z] as [number, number, number], scale, type });
      }
      return items;
  }, []);

  const rocks = useMemo(() => {
      const items = [];
      for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 10 + Math.random() * 35;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const scale = 0.8 + Math.random() * 1.5;
          items.push({ position: [x, -2, z] as [number, number, number], scale });
      }
      return items;
  }, []);

  const bushes = useMemo(() => {
      const items = [];
      const colors = ['#556b2f', '#6b8e23', '#334411', '#8f9779'];
      for (let i = 0; i < 50; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 5 + Math.random() * 40;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const scale = 0.6 + Math.random() * 0.6;
          const color = colors[Math.floor(Math.random() * colors.length)];
          items.push({ position: [x, -2, z] as [number, number, number], scale, color });
      }
      return items;
  }, []);

  return (
    <group>
      {/* Ground - Moved to y=-2 to match physics/visuals */}
      <RigidBody type="fixed" colliders="hull">
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial map={texture} color="#4e342e" roughness={1} />
        </mesh>
      </RigidBody>

      {/* Trees */}
      {trees.map((tree, i) => (
          <Tree key={i} position={tree.position} scale={tree.scale} type={tree.type as 'normal' | 'dead'} />
      ))}

      {/* Rocks */}
      {rocks.map((rock, i) => (
          <Rock key={i} position={rock.position} scale={rock.scale} />
      ))}

      {/* Bushes */}
      {bushes.map((bush, i) => (
          <Bush key={i} position={bush.position} scale={bush.scale} color={bush.color} />
      ))}

      {/* Grass - Adjusted elevation in component if needed, but here we just render it */}
      <Grass />
      
      {/* Small Stones on Ground */}
      <SmallStones />

      {/* Background Hills */}
      <Hills />

      {/* Ancient Ruins - Wall - Adjusted Y to sit on ground at -2 */}
      <RigidBody type="fixed" colliders="cuboid" position={[-10, -1, 10]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[8, 3, 1]} />
          <meshStandardMaterial color="#a1887f" roughness={0.9} />
        </mesh>
        <mesh castShadow receiveShadow position={[2, 2, 0]} rotation={[0, 0, 0.2]}>
          <boxGeometry args={[2, 1, 0.8]} />
          <meshStandardMaterial color="#a1887f" roughness={0.9} />
        </mesh>
        {/* Debris */}
        <mesh castShadow receiveShadow position={[-3, -1, 1]} rotation={[0.5, 0.5, 0]}>
           <boxGeometry args={[1, 1, 1]} />
           <meshStandardMaterial color="#8d6e63" />
        </mesh>
      </RigidBody>

      {/* Map Boundaries - Invisible Walls */}
      <RigidBody type="fixed" colliders="cuboid">
        {/* North Wall */}
        <mesh position={[0, 10, -50]}>
          <boxGeometry args={[100, 30, 1]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        {/* South Wall */}
        <mesh position={[0, 10, 50]}>
          <boxGeometry args={[100, 30, 1]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        {/* East Wall */}
        <mesh position={[50, 10, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[100, 30, 1]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        {/* West Wall */}
        <mesh position={[-50, 10, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[100, 30, 1]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      </RigidBody>
    </group>
  );
}
