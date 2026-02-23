import { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, RapierRigidBody, CapsuleCollider } from '@react-three/rapier';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { playerRef } from './Player';

interface EnemyProps {
  id: string;
  position: [number, number, number];
  health: number;
}

const ENEMY_SPEED = 4;

export function Enemy({ id, position, health }: EnemyProps) {
  const rigidBody = useRef<RapierRigidBody>(null);
  const group = useRef<THREE.Group>(null);
  const { removeEnemy, addScore, takeDamage, damageEnemy, addEffect, isPaused, isDodging } = useStore();
  
  const [isStaggered, setIsStaggered] = useState(false);
  const [isDead, setIsDead] = useState(false);
  
  // AI State
  const [state, setState] = useState<'chase' | 'search'>('chase');
  const searchTarget = useRef<THREE.Vector3 | null>(null);
  const lastSeenPlayer = useRef<number>(0);

  const lastAttackTime = useRef<number>(0);
  const ATTACK_COOLDOWN = 2000;
  const isAttacking = useRef(false);

  useFrame((clockState, delta) => {
    if (!rigidBody.current || !playerRef.current || isDead || isPaused) return;

    if (isStaggered) {
      rigidBody.current.setLinvel({ x: 0, y: rigidBody.current.linvel().y, z: 0 }, true);
      return;
    }

    const enemyPos = rigidBody.current.translation();
    const playerPos = playerRef.current.translation();
    const distToPlayer = new THREE.Vector3(enemyPos.x, 0, enemyPos.z).distanceTo(new THREE.Vector3(playerPos.x, 0, playerPos.z));

    // Line of Sight / Distance check
    const canSeePlayer = distToPlayer < 20;

    if (canSeePlayer) {
      if (state !== 'chase') {
          // Play growl sound on spot
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3'); // Placeholder growl
          audio.volume = 0.2;
          audio.playbackRate = 0.5;
          audio.play().catch(() => {});
      }
      setState('chase');
      lastSeenPlayer.current = Date.now();
      
      // Attack Logic
      if (distToPlayer < 3 && !isAttacking.current && Date.now() - lastAttackTime.current > ATTACK_COOLDOWN) {
          isAttacking.current = true;
          
          // Wind up animation (visual only)
          if (group.current) {
              group.current.position.y = 0.2;
              group.current.rotation.x = -0.5; // Lean back
          }
          
          setTimeout(() => {
              // Lunge / Attack
              if (rigidBody.current && playerRef.current && !isDead) {
                  // Lunge forward
                  const currentPos = rigidBody.current.translation();
                  const pPos = playerRef.current.translation();
                  const lungeDir = new THREE.Vector3(pPos.x - currentPos.x, 0, pPos.z - currentPos.z).normalize();
                  rigidBody.current.applyImpulse({ x: lungeDir.x * 20, y: 2, z: lungeDir.z * 20 }, true);
                  
                  // Visual Lunge
                  if (group.current) {
                      group.current.rotation.x = 0.5; // Lean forward
                  }

                  // Check Hit
                  const hitDist = new THREE.Vector3(currentPos.x, 0, currentPos.z).distanceTo(new THREE.Vector3(pPos.x, 0, pPos.z));
                  if (hitDist < 3.5 && !useStore.getState().isDodging) {
                      takeDamage(15);
                      
                      // Attack Sound
                      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3'); 
                      audio.volume = 0.5;
                      audio.playbackRate = 1.5;
                      audio.play().catch(() => {});
                      
                      // Knockback Player (Optional, maybe just visual shake)
                  }
              }
              
              setTimeout(() => {
                  isAttacking.current = false;
                  lastAttackTime.current = Date.now();
                  if (group.current) group.current.rotation.x = 0;
              }, 500);
          }, 400);
      }

    } else if (Date.now() - lastSeenPlayer.current > 5000 && state === 'chase') {
      setState('search');
      searchTarget.current = null;
    }

    let moveDir = new THREE.Vector3();

    if (!isAttacking.current) {
        if (state === 'chase') {
          moveDir.subVectors(playerPos, enemyPos).normalize();
        } else if (state === 'search') {
          if (!searchTarget.current || new THREE.Vector3(enemyPos.x, 0, enemyPos.z).distanceTo(new THREE.Vector3(searchTarget.current.x, 0, searchTarget.current.z)) < 1) {
             const angle = Math.random() * Math.PI * 2;
             const radius = 5 + Math.random() * 5;
             searchTarget.current = new THREE.Vector3(
               enemyPos.x + Math.cos(angle) * radius,
               enemyPos.y,
               enemyPos.z + Math.sin(angle) * radius
             );
          }
          moveDir.subVectors(searchTarget.current, enemyPos).normalize();
        }
    }

    // Apply movement
    const speed = state === 'chase' ? ENEMY_SPEED : ENEMY_SPEED * 0.5;
    const currentVel = rigidBody.current.linvel();
    
    if (!isAttacking.current) {
        rigidBody.current.setLinvel({ x: moveDir.x * speed, y: currentVel.y, z: moveDir.z * speed }, true);
        
        // Face movement direction
        if (moveDir.lengthSq() > 0.1) {
          const angle = Math.atan2(moveDir.x, moveDir.z);
          rigidBody.current.setRotation({ x: 0, y: angle, z: 0, w: 1 }, true);
        }
    }

    // Animation (Idle/Run)
    if (group.current && !isAttacking.current) {
      const freq = state === 'chase' ? 15 : 8;
      group.current.position.y = Math.sin(clockState.clock.elapsedTime * freq) * 0.1;
      
      if (state === 'search' && Math.sin(clockState.clock.elapsedTime * 2) > 0.8) {
         group.current.rotation.x = 0.3;
      } else {
         group.current.rotation.x = 0;
      }
    }
  });

  const handleHit = (impactPos?: THREE.Vector3) => {
    if (isDead) return;

    const damage = 15;
    const newHealth = health - damage;
    
    if (rigidBody.current) {
      const pos = rigidBody.current.translation();
      // Blood effect at impact or center
      addEffect(impactPos ? [impactPos.x, impactPos.y, impactPos.z] : [pos.x, pos.y + 0.5, pos.z], 'blood');
      
      // Dust/Impact effect
      addEffect(impactPos ? [impactPos.x, impactPos.y, impactPos.z] : [pos.x, pos.y + 0.5, pos.z], 'impact');

      // Knockback
      if (playerRef.current) {
          const playerPos = playerRef.current.translation();
          const knockbackDir = new THREE.Vector3(pos.x - playerPos.x, 0, pos.z - playerPos.z).normalize();
          rigidBody.current.applyImpulse({ x: knockbackDir.x * 10, y: 2, z: knockbackDir.z * 10 }, true);
      }
    }

    if (newHealth <= 0) {
      setIsDead(true);
      addScore(50);
      
      if (rigidBody.current) {
        const pos = rigidBody.current.translation();
        addEffect([pos.x, pos.y, pos.z], 'smoke');

        // Ragdoll physics - fling body slightly
        rigidBody.current.setLinvel({ 
          x: (Math.random() - 0.5) * 5, 
          y: 3, 
          z: (Math.random() - 0.5) * 5 
        }, true);
        rigidBody.current.setAngvel({ 
          x: (Math.random() - 0.5) * 10, 
          y: (Math.random() - 0.5) * 10, 
          z: (Math.random() - 0.5) * 10 
        }, true);
        rigidBody.current.setEnabledRotations(true, true, true, true);
      }

      setTimeout(() => {
        removeEnemy(id);
      }, 2000);
    } else {
      damageEnemy(id, damage);
      setIsStaggered(true);
      setState('chase');
      lastSeenPlayer.current = Date.now();
      
      // Stagger animation (visual shake)
      if (group.current) {
          group.current.rotation.z = (Math.random() - 0.5) * 0.5;
          setTimeout(() => {
              if (group.current) group.current.rotation.z = 0;
          }, 200);
      }

      setTimeout(() => {
        setIsStaggered(false);
      }, 500);
    }
  };

  return (
    <RigidBody
      ref={rigidBody}
      position={position}
      colliders={false}
      enabledRotations={[false, true, false]}
      userData={{ type: 'enemy', id }}
      onCollisionEnter={({ other }) => {
        if (other.rigidBodyObject?.userData?.type === 'stone') {
          // Try to get contact point if available, otherwise undefined
          handleHit();
        }
      }}
    >
      <CapsuleCollider args={[0.4, 0.4]} position={[0, 0.4, 0]} /> {/* Increased collider size */}
      <group ref={group} scale={0.7}> {/* Scaled down wolf */}
        
        {/* Health Bar */}
        <Html position={[0, 1.5, 0]} center>
          <div className="w-16 h-2 bg-gray-700 border border-black rounded overflow-hidden">
            <div 
              className="h-full bg-red-600 transition-all duration-200"
              style={{ width: `${(health / 30) * 100}%` }} // Assuming max health 30
            />
          </div>
        </Html>

        {/* Wolf Body - High Res & Menacing */}
        <group position={[0, 0.4, 0]}>
           {/* Main Body - Muscular */}
          <mesh castShadow position={[0, 0.1, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.35, 0.9, 8, 16]} />
            <meshStandardMaterial color={isStaggered ? "#800" : "#2a2a2a"} roughness={0.8} />
          </mesh>
          
          {/* Fur/Mane - Spiky and dark */}
          <mesh position={[0, 0.45, -0.3]} rotation={[-0.5, 0, 0]}>
             <coneGeometry args={[0.15, 0.5, 8]} />
             <meshStandardMaterial color="#0a0a0a" />
          </mesh>
          <mesh position={[0, 0.45, 0]} rotation={[-0.3, 0, 0]}>
             <coneGeometry args={[0.15, 0.5, 8]} />
             <meshStandardMaterial color="#0a0a0a" />
          </mesh>
          <mesh position={[0, 0.45, 0.3]} rotation={[-0.1, 0, 0]}>
             <coneGeometry args={[0.15, 0.5, 8]} />
             <meshStandardMaterial color="#0a0a0a" />
          </mesh>

          {/* Head - More detailed */}
          <group position={[0, 0.4, 0.7]}>
            <mesh castShadow>
              <boxGeometry args={[0.45, 0.5, 0.6]} />
              <meshStandardMaterial color={isStaggered ? "#800" : "#2a2a2a"} />
            </mesh>
            
            {/* Glowing Eyes - Angled */}
            <mesh position={[0.18, 0.1, 0.25]} rotation={[0, -0.2, 0]}>
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={4} />
            </mesh>
            <mesh position={[-0.18, 0.1, 0.25]} rotation={[0, 0.2, 0]}>
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={4} />
            </mesh>
            
            {/* Brow Ridge */}
             <mesh position={[0, 0.25, 0.28]} rotation={[0.2, 0, 0]}>
               <boxGeometry args={[0.5, 0.1, 0.2]} />
               <meshStandardMaterial color="#1a1a1a" />
             </mesh>

            {/* Snout & Teeth - Longer and sharper */}
            <mesh castShadow position={[0, -0.1, 0.5]}>
              <boxGeometry args={[0.28, 0.25, 0.5]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
            
            {/* Fangs */}
            <mesh position={[0.1, -0.25, 0.6]} rotation={[Math.PI, 0, 0]}>
               <coneGeometry args={[0.04, 0.15, 8]} />
               <meshStandardMaterial color="#ffffee" roughness={0.2} />
            </mesh>
            <mesh position={[-0.1, -0.25, 0.6]} rotation={[Math.PI, 0, 0]}>
               <coneGeometry args={[0.04, 0.15, 8]} />
               <meshStandardMaterial color="#ffffee" roughness={0.2} />
            </mesh>

            {/* Ears - Pointy */}
            <mesh position={[0.2, 0.35, -0.1]} rotation={[-0.2, 0, 0.2]}>
              <coneGeometry args={[0.1, 0.35, 8]} />
              <meshStandardMaterial color="#2a2a2a" />
            </mesh>
            <mesh position={[-0.2, 0.35, -0.1]} rotation={[-0.2, 0, -0.2]}>
              <coneGeometry args={[0.1, 0.35, 8]} />
              <meshStandardMaterial color="#2a2a2a" />
            </mesh>
          </group>

          {/* Legs - Thicker */}
          <group>
              <mesh position={[0.25, -0.4, 0.4]} rotation={[0.2, 0, 0]}>
                 <cylinderGeometry args={[0.08, 0.06, 0.7, 8]} />
                 <meshStandardMaterial color="#1a1a1a" />
              </mesh>
              <mesh position={[-0.25, -0.4, 0.4]} rotation={[0.2, 0, 0]}>
                 <cylinderGeometry args={[0.08, 0.06, 0.7, 8]} />
                 <meshStandardMaterial color="#1a1a1a" />
              </mesh>
              <mesh position={[0.25, -0.4, -0.4]} rotation={[-0.2, 0, 0]}>
                 <cylinderGeometry args={[0.08, 0.06, 0.7, 8]} />
                 <meshStandardMaterial color="#1a1a1a" />
              </mesh>
              <mesh position={[-0.25, -0.4, -0.4]} rotation={[-0.2, 0, 0]}>
                 <cylinderGeometry args={[0.08, 0.06, 0.7, 8]} />
                 <meshStandardMaterial color="#1a1a1a" />
              </mesh>
          </group>
          
          {/* Tail - Bushy */}
          <mesh position={[0, 0.2, -0.6]} rotation={[-0.4, 0, 0]}>
             <cylinderGeometry args={[0.1, 0.02, 0.8, 8]} />
             <meshStandardMaterial color="#2a2a2a" />
          </mesh>
        </group>
      </group>
    </RigidBody>
  );
}
