import { useRef, useState, useEffect, createRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useRapier, RigidBody, CapsuleCollider, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useStore } from '../store';

const SPEED = 5;
const JUMP_FORCE = 5;
const SLING_COOLDOWN = 500; // ms
const STONE_SPEED = 35;

// Export a ref to track player position for enemies
export const playerRef = createRef<RapierRigidBody>();

export function Player() {
  const { camera, scene } = useThree();
  const [lastShot, setLastShot] = useState(0);
  const { isPaused, shootStone, damageEnemy, addEffect, setDodging } = useStore();
  const playerMesh = useRef<THREE.Group>(null);
  const [weapon, setWeapon] = useState<'sling' | 'knife'>('sling');
  const [isAttacking, setIsAttacking] = useState(false);
  
  // Movement state
  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    dash: false,
  });
  
  const joystick = useRef({ x: 0, y: 0 });
  const [lastDash, setLastDash] = useState(0);
  const DASH_COOLDOWN = 1000;
  const DASH_FORCE = 25; // Increased slightly
  const DASH_DURATION = 300; // ms of invulnerability

  const jumpCount = useRef(0);
  const isJumping = useRef(false);

  // Input handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': keys.current.forward = true; break;
        case 'KeyS': keys.current.backward = true; break;
        case 'KeyA': keys.current.left = true; break;
        case 'KeyD': keys.current.right = true; break;
        case 'Space': 
            if (!keys.current.jump) {
                handleJump();
            }
            keys.current.jump = true; 
            break;
        case 'ShiftLeft': keys.current.dash = true; break;
        case 'Digit1': setWeapon('sling'); break;
        case 'Digit2': setWeapon('knife'); break;
      }
    };

    const handleJump = () => {
        if (!playerRef.current || isPaused) return;
        const vel = playerRef.current.linvel();
        
        // Ground check tolerance
        const isGrounded = Math.abs(vel.y) < 0.1;

        if (isGrounded) {
            jumpCount.current = 1;
            performJump(JUMP_FORCE);
        } else if (jumpCount.current < 2) {
            jumpCount.current = 2;
            performJump(JUMP_FORCE * 0.8); // Slightly weaker double jump
            
            // Double jump effect
            const pos = playerRef.current.translation();
            addEffect([pos.x, pos.y - 0.5, pos.z], 'impact');
        }
    };

    const performJump = (force: number) => {
        if (!playerRef.current) return;
        const vel = playerRef.current.linvel();
        playerRef.current.setLinvel({ x: vel.x, y: force, z: vel.z }, true);
        
        // Animation trigger
        isJumping.current = true;
        
        // Squash and Stretch Animation
        if (playerMesh.current) {
            // Stretch up
            playerMesh.current.scale.set(0.8, 1.2, 0.8); 
            
            // Return to normal
            setTimeout(() => {
                if (playerMesh.current) {
                    // Smooth return to normal could be handled in useFrame, but setTimeout is simple enough for now.
                    // Let's just set it back to 1,1,1. The landing will squash it.
                    playerMesh.current.scale.set(1, 1, 1);
                }
            }, 200);
        }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': keys.current.forward = false; break;
        case 'KeyS': keys.current.backward = false; break;
        case 'KeyA': keys.current.left = false; break;
        case 'KeyD': keys.current.right = false; break;
        case 'Space': keys.current.jump = false; break;
        case 'ShiftLeft': keys.current.dash = false; break;
      }
    };
    
    const handleJoystickMove = (e: CustomEvent) => {
        joystick.current = e.detail;
    };

    const handleDash = () => {
        keys.current.dash = true;
        setTimeout(() => keys.current.dash = false, 100);
    };
    
    const handleWeaponSelect = (e: CustomEvent) => {
        setWeapon(e.detail);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('joystickMove', handleJoystickMove as EventListener);
    window.addEventListener('dash', handleDash);
    window.addEventListener('weaponSelect', handleWeaponSelect as EventListener);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('joystickMove', handleJoystickMove as EventListener);
      window.removeEventListener('dash', handleDash);
      window.removeEventListener('weaponSelect', handleWeaponSelect as EventListener);
    };
  }, []); // Empty dependency array for stable input handling

  // Attack handler
  useEffect(() => {
    const triggerAttack = (type: 'sling' | 'knife') => {
      if (isPaused || isAttacking) return;
      
      const now = Date.now();
      
      if (type === 'sling') {
        if (now - lastShot > SLING_COOLDOWN) {
          setWeapon('sling');
          setLastShot(now);
          setIsAttacking(true);
          
          // Delay shot for windup animation (100ms) - Reduced for responsiveness
          setTimeout(() => {
              if (!playerRef.current) return;
              const pos = playerRef.current.translation();
              
              const direction = new THREE.Vector3();
              camera.getWorldDirection(direction);
              
              // Calculate target point in the distance (where the crosshair is aiming)
              const targetDistance = 40; // Slightly closer convergence for mid-range accuracy
              const targetPoint = camera.position.clone().add(direction.clone().multiplyScalar(targetDistance));

              // Calculate right vector for offset
              const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();

              // Spawn position (hand - offset to right)
              const spawnPos = new THREE.Vector3(pos.x, pos.y + 1.0, pos.z)
                  .add(direction.clone().normalize().multiplyScalar(0.5)) // Forward
                  .add(right.multiplyScalar(0.2)); // Right (Shoulder width)

              // Calculate velocity vector from spawn point to target point
              const velocityDir = new THREE.Vector3().subVectors(targetPoint, spawnPos).normalize();
              
              // Add upward bias for arc (Minimal, high speed)
              velocityDir.y += 0.02; 
              
              const velocity = velocityDir.multiplyScalar(STONE_SPEED);
              
              shootStone([spawnPos.x, spawnPos.y, spawnPos.z], [velocity.x, velocity.y, velocity.z]);
          }, 100);
          
          // Animation duration matches cooldown roughly
          setTimeout(() => setIsAttacking(false), 500);
        }
      } else if (type === 'knife') {
        setWeapon('knife');
        setIsAttacking(true);
        setLastShot(now);
        
        const enemies = useStore.getState().enemies;
        const playerPos = playerRef.current?.translation();
        if (!playerPos) return;
        
        const playerVec = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
        const lookDir = new THREE.Vector3();
        camera.getWorldDirection(lookDir);
        
        enemies.forEach(enemy => {
          const enemyVec = new THREE.Vector3(enemy.position[0], enemy.position[1], enemy.position[2]);
          const dist = playerVec.distanceTo(enemyVec);
          
          if (dist < 3) {
            const dirToEnemy = enemyVec.clone().sub(playerVec).normalize();
            const dot = lookDir.dot(dirToEnemy);
            
            if (dot > 0.8) {
               damageEnemy(enemy.id, 15);
               addEffect(enemy.position, 'blood');
            }
          }
        });
        
        setTimeout(() => setIsAttacking(false), 400);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      // 0 is left click (knife), 2 is right click (sling)
      if (e.button === 0) {
        triggerAttack('knife');
      } else if (e.button === 2) {
        triggerAttack('sling');
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // Prevent right-click menu
    };

    const handleCustomAttack = (e: CustomEvent) => {
      triggerAttack(e.detail);
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('attack', handleCustomAttack as EventListener);
    
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('attack', handleCustomAttack as EventListener);
    };
  }, [isPaused, lastShot, shootStone, camera, isAttacking, damageEnemy, addEffect]);

  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const slingRef = useRef<THREE.Group>(null);
  const knifeRef = useRef<THREE.Group>(null);

  // Gamepad state
  const gamepadState = useRef({
      lastAttackTime: 0,
      lastDodgeTime: 0,
      lastJumpTime: 0,
      lastPauseTime: 0,
  });

  useFrame((state) => {
    if (!playerRef.current || isPaused) return;

    // Weapon scale animation
    if (slingRef.current) {
        const targetScale = weapon === 'sling' ? 1 : 0;
        slingRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.2);
        
        // Add a little rotation for flair when drawing the weapon
        if (targetScale === 1 && slingRef.current.scale.x < 0.9) {
            slingRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 20) * 0.2;
        } else {
            slingRef.current.rotation.z = 0;
        }
    }
    if (knifeRef.current) {
        const targetScale = weapon === 'knife' ? 1 : 0;
        knifeRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.2);
        
        // Add a little rotation for flair when drawing the weapon
        if (targetScale === 1 && knifeRef.current.scale.x < 0.9) {
            knifeRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 20) * 0.2;
        } else {
            knifeRef.current.rotation.z = 0;
        }
    }

    // Get current velocity
    const vel = playerRef.current.linvel();

    // Gamepad Input Handling
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0]; // Use first gamepad
    
    let gpForward = 0;
    let gpSide = 0;
    
    if (gp) {
        // Left stick for movement
        if (Math.abs(gp.axes[1]) > 0.1) gpForward = gp.axes[1];
        if (Math.abs(gp.axes[0]) > 0.1) gpSide = gp.axes[0];
        
        // Right stick for camera (handled in App.tsx or here? Better here for now if we can access camera)
        if (Math.abs(gp.axes[2]) > 0.1 || Math.abs(gp.axes[3]) > 0.1) {
            const euler = new THREE.Euler(0, 0, 0, 'YXZ');
            euler.setFromQuaternion(camera.quaternion);
            euler.y -= gp.axes[2] * 0.05;
            euler.x -= gp.axes[3] * 0.05;
            euler.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, euler.x));
            camera.quaternion.setFromEuler(euler);
        }

        const now = Date.now();
        
        // Buttons
        // A / Cross (0) -> Attack (Knife)
        if (gp.buttons[0].pressed && now - gamepadState.current.lastAttackTime > 500) {
            window.dispatchEvent(new CustomEvent('attack', { detail: 'knife' }));
            gamepadState.current.lastAttackTime = now;
        }
        
        // B / Circle (1) or X / Square (2) -> Attack (Sling)
        if ((gp.buttons[1].pressed || gp.buttons[2].pressed) && now - gamepadState.current.lastAttackTime > 500) {
            window.dispatchEvent(new CustomEvent('attack', { detail: 'sling' }));
            gamepadState.current.lastAttackTime = now;
        }
        
        // Shoulders (4, 5) -> Dodge
        if ((gp.buttons[4].pressed || gp.buttons[5].pressed) && now - gamepadState.current.lastDodgeTime > 500) {
            window.dispatchEvent(new Event('dash'));
            gamepadState.current.lastDodgeTime = now;
        }
        
        // Y / Triangle (3) -> Jump
        if (gp.buttons[3].pressed && now - gamepadState.current.lastJumpTime > 500) {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
            gamepadState.current.lastJumpTime = now;
        } else if (!gp.buttons[3].pressed) {
            window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
        }
        
        // Start (9) -> Pause
        if (gp.buttons[9].pressed && now - gamepadState.current.lastPauseTime > 1000) {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
            gamepadState.current.lastPauseTime = now;
        }
    }

    // ... (camera direction logic)
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0;
    cameraDirection.normalize();
    
    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));

    // Combine Keyboard and Joystick and Gamepad input
    const forwardInput = (Number(keys.current.forward) - Number(keys.current.backward)) + (-joystick.current.y) + gpForward;
    const sideInput = (Number(keys.current.right) - Number(keys.current.left)) + (joystick.current.x) + gpSide;

    const inputVector = new THREE.Vector2(sideInput, forwardInput);
    if (inputVector.length() > 1) inputVector.normalize();

    const frontVector = cameraDirection.clone().multiplyScalar(inputVector.y);
    const sideVector = cameraRight.clone().multiplyScalar(inputVector.x);

    const direction = new THREE.Vector3();
    direction.addVectors(frontVector, sideVector);
    
    // Rotate player mesh to face camera direction (Back to camera)
    if (playerMesh.current) {
        // Calculate target rotation (Camera yaw + PI because model faces -Z)
        const targetRotation = Math.atan2(cameraDirection.x, cameraDirection.z) + Math.PI;
        
        // Smooth rotation
        let rotDiff = targetRotation - playerMesh.current.rotation.y;
        // Normalize angle to -PI to PI
        while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
        while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
        
        playerMesh.current.rotation.y += rotDiff * 0.2;
    }

    if (direction.length() > 0) {
      direction.normalize().multiplyScalar(SPEED);
      direction.multiplyScalar(Math.min(inputVector.length(), 1)); 
    }

    // Dash Logic
    if (keys.current.dash) {
        const now = Date.now();
        if (now - lastDash > DASH_COOLDOWN) {
            setLastDash(now);
            const dashDir = direction.length() > 0 ? direction.normalize() : cameraDirection;
            playerRef.current.applyImpulse({ x: dashDir.x * DASH_FORCE, y: 0, z: dashDir.z * DASH_FORCE }, true);
            
            // Visual effect for dash
            addEffect([playerRef.current.translation().x, playerRef.current.translation().y, playerRef.current.translation().z], 'impact');
            
            // Invulnerability
            setDodging(true);
            setTimeout(() => setDodging(false), DASH_DURATION);
        }
    }

    // Apply velocity (keep Y velocity for gravity)
    // Let's try: If recently dashed, let physics handle it.
    if (Date.now() - lastDash < 200) {
        // Dashing, let momentum carry
    } else {
        playerRef.current.setLinvel({ x: direction.x, y: vel.y, z: direction.z }, true);
    }

    // Ground Check & Reset Jump Count
    if (Math.abs(vel.y) < 0.05) {
        if (isJumping.current) {
            // Landing Squash
            if (playerMesh.current) {
                playerMesh.current.scale.set(1.2, 0.8, 1.2);
                setTimeout(() => {
                    if (playerMesh.current) playerMesh.current.scale.set(1, 1, 1);
                }, 100);
            }
        }
        jumpCount.current = 0;
        isJumping.current = false;
    }

    // Camera Follow Logic
    const playerPos = playerRef.current.translation();
    const cameraTargetPos = new THREE.Vector3(playerPos.x, playerPos.y + 2.5, playerPos.z); // Height offset

    // Calculate direction from camera to player (horizontal only for consistent distance)
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    camDir.y = 0;
    if (camDir.lengthSq() > 0) {
      camDir.normalize();
    } else {
      camDir.set(0, 0, 1);
    }

    const CAMERA_DISTANCE = 5;
    cameraTargetPos.sub(camDir.multiplyScalar(CAMERA_DISTANCE));

    // Smoothly move camera
    camera.position.lerp(cameraTargetPos, 0.25); // Faster tracking for responsiveness

    // Animation Logic
    const time = state.clock.getElapsedTime();
    const speed = new THREE.Vector3(vel.x, 0, vel.z).length();
    
    if (leftLeg.current && rightLeg.current && leftArm.current && rightArm.current && playerMesh.current) {
        // Walking Animation
        if (speed > 0.1) {
            const freq = 12; // Slightly faster steps
            const amp = 0.7; // More exaggerated swing
            
            // Legs - Swing with slight knee bend simulation (visual only via rotation)
            leftLeg.current.rotation.x = Math.sin(time * freq) * amp;
            rightLeg.current.rotation.x = Math.sin(time * freq + Math.PI) * amp;
            
            // Arms - Opposite to legs
            leftArm.current.rotation.x = Math.sin(time * freq + Math.PI) * amp;
            leftArm.current.rotation.z = 0.15; // More outward angle
            
            // Body Bobbing - More noticeable
            playerMesh.current.position.y = -0.8 + Math.abs(Math.sin(time * freq)) * 0.08;
            
            // Right arm follows walk cycle unless attacking
            if (!isAttacking) {
                rightArm.current.rotation.x = Math.sin(time * freq) * amp;
                rightArm.current.rotation.z = -0.15; // More outward angle
            }
        } else {
            // Idle - Breathing
            const breathe = Math.sin(time * 2) * 0.02;
            playerMesh.current.position.y = THREE.MathUtils.lerp(playerMesh.current.position.y, -0.8 + breathe, 0.1);

            leftLeg.current.rotation.x = THREE.MathUtils.lerp(leftLeg.current.rotation.x, 0, 0.1);
            rightLeg.current.rotation.x = THREE.MathUtils.lerp(rightLeg.current.rotation.x, 0, 0.1);
            
            leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, 0, 0.1);
            leftArm.current.rotation.z = THREE.MathUtils.lerp(leftArm.current.rotation.z, 0.1, 0.1);

            if (!isAttacking) {
                rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, 0, 0.1);
                rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, -0.1, 0.1);
            }
        }

        // Attack Animation (Right Arm)
        if (isAttacking) {
            if (weapon === 'sling') {
                // Sling animation: Wind up and Throw
                const timeSinceShot = Date.now() - lastShot;
                
                if (timeSinceShot < 100) {
                    // Wind up Phase (0-100ms) - Very fast pull back
                    // Rotate arm back and up significantly
                    rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, -Math.PI * 1.4, 0.5);
                    rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, 1.2, 0.5); 
                } else {
                    // Throw Phase (100ms+)
                    const throwProgress = (timeSinceShot - 100) / 400; // Remaining time
                    
                    if (throwProgress < 0.15) {
                        // Snap Forward (Release) - Instant whip
                        rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, Math.PI * 0.6, 0.8);
                        rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, 0, 0.8);
                    } else {
                        // Follow Through / Recovery - Slow return
                        rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, 0, 0.15);
                        rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, -0.1, 0.15);
                    }
                }
            } else {
                // Knife stab
                const attackTime = (Date.now() - lastShot) / 400;
                if (attackTime < 0.5) {
                    // Stab out
                     rightArm.current.rotation.x = THREE.MathUtils.lerp(0, -Math.PI/2, attackTime * 2);
                } else {
                    // Return
                     rightArm.current.rotation.x = THREE.MathUtils.lerp(-Math.PI/2, 0, (attackTime - 0.5) * 2);
                }
            }
        }
    }
  });

  return (
    <RigidBody
      ref={playerRef}
      colliders={false}
      mass={1}
      type="dynamic"
      position={[0, 5, 0]}
      enabledRotations={[false, false, false]}
      lockRotations
      userData={{ type: 'player' }}
    >
      <CapsuleCollider args={[0.75, 0.5]} />
      
      {/* Visible Player Model - Young David - High Res */}
      <group ref={playerMesh} position={[0, -0.8, 0]}>
        {/* Tunic (Body) - Better shape */}
        <mesh castShadow position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.28, 0.42, 1.2, 16]} /> {/* Increased segments */}
          <meshStandardMaterial color="#e3dac9" roughness={0.9} />
        </mesh>
        
        {/* Scarf / Shawl */}
        <mesh position={[0, 1.15, 0]} rotation={[0.1, 0, 0]}>
             <torusGeometry args={[0.3, 0.08, 8, 16]} />
             <meshStandardMaterial color="#8D6E63" />
        </mesh>

        {/* Bag Strap */}
        <mesh position={[0, 0.7, 0]} rotation={[0, 0, -0.8]} scale={[1, 1, 1.2]}>
             <torusGeometry args={[0.32, 0.03, 8, 16]} />
             <meshStandardMaterial color="#3E2723" />
        </mesh>
        
        {/* Shepherd's Bag */}
        <mesh position={[0.25, 0.4, 0.2]} rotation={[0, 0, -0.2]} castShadow>
             <boxGeometry args={[0.2, 0.25, 0.1]} />
             <meshStandardMaterial color="#5D4037" />
        </mesh>
        <mesh position={[0.15, 0.55, 0.1]} rotation={[0, 0, -0.4]}>
             <cylinderGeometry args={[0.01, 0.01, 0.4]} />
             <meshStandardMaterial color="#3E2723" />
        </mesh>
        
        {/* Belt/Sash - Detailed */}
        <mesh castShadow position={[0, 0.6, 0]} scale={[1.05, 1, 1.05]}>
          <cylinderGeometry args={[0.3, 0.4, 0.25, 16]} />
          <meshStandardMaterial color="#8b4513" />
        </mesh>
        <mesh position={[0.2, 0.5, 0.25]} rotation={[0, 0, -0.2]}>
           <boxGeometry args={[0.1, 0.3, 0.05]} />
           <meshStandardMaterial color="#8b4513" />
        </mesh>

        {/* Head */}
        <mesh castShadow position={[0, 1.4, 0]}>
          <sphereGeometry args={[0.26, 32, 32]} /> {/* Higher res sphere */}
          <meshStandardMaterial color="#ffcd94" />
        </mesh>

        {/* Face Details */}
        <group position={[0, 1.4, -0.22]}>
          {/* Eyes */}
          <mesh position={[0.08, 0.05, 0]}>
            <sphereGeometry args={[0.03, 16, 16]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[-0.08, 0.05, 0]}>
            <sphereGeometry args={[0.03, 16, 16]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          {/* Eyebrows */}
          <mesh position={[0.08, 0.12, -0.01]} rotation={[0, 0, -0.1]}>
             <boxGeometry args={[0.08, 0.02, 0.01]} />
             <meshStandardMaterial color="#8b0000" /> {/* Red eyebrows */}
          </mesh>
          <mesh position={[-0.08, 0.12, -0.01]} rotation={[0, 0, 0.1]}>
             <boxGeometry args={[0.08, 0.02, 0.01]} />
             <meshStandardMaterial color="#8b0000" /> {/* Red eyebrows */}
          </mesh>
          {/* Nose */}
          <mesh position={[0, 0, -0.05]}>
             <coneGeometry args={[0.03, 0.08, 8]} />
             <meshStandardMaterial color="#ffcd94" />
          </mesh>
          {/* Beard (New) */}
          <mesh position={[0, -0.12, -0.02]} rotation={[0.2, 0, 0]}>
             <boxGeometry args={[0.18, 0.12, 0.08]} />
             <meshStandardMaterial color="#A0522D" /> {/* Sienna beard */}
          </mesh>
        </group>

        {/* Hair (Reddish/Orange) - More detailed */}
        <group position={[0, 1.45, 0]}>
          <mesh castShadow position={[0, 0.1, 0.05]}>
            <sphereGeometry args={[0.28, 32, 32, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
            <meshStandardMaterial color="#8B0000" roughness={1} /> {/* DarkRed */}
          </mesh>
          {/* Curls/Messy bits */}
          <mesh position={[0.22, 0, 0]} rotation={[0, 0, -0.2]}>
             <sphereGeometry args={[0.09, 16, 16]} />
             <meshStandardMaterial color="#8B0000" />
          </mesh>
          <mesh position={[-0.22, 0, 0]} rotation={[0, 0, 0.2]}>
             <sphereGeometry args={[0.09, 16, 16]} />
             <meshStandardMaterial color="#8B0000" />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
             <sphereGeometry args={[0.1, 16, 16]} />
             <meshStandardMaterial color="#8B0000" />
          </mesh>
        </group>

        {/* Arms - Pivot at shoulder */}
        <group ref={leftArm} position={[-0.35, 1.3, 0]}>
            <mesh castShadow position={[0, -0.3, 0]}>
                <capsuleGeometry args={[0.08, 0.6, 8, 16]} />
                <meshStandardMaterial color="#ffcd94" />
            </mesh>
        </group>
        
        <group ref={rightArm} position={[0.35, 1.3, 0]}>
            <mesh castShadow position={[0, -0.3, 0]}>
                <capsuleGeometry args={[0.08, 0.6, 8, 16]} />
                <meshStandardMaterial color="#ffcd94" />
            </mesh>
            
            {/* Weapon: Sling (Attached to Right Arm) */}
            <group ref={slingRef} position={[0, -0.6, 0.1]} rotation={[0, 0, 0]}>
               {/* Main Leather Strip */}
               <mesh>
                 <boxGeometry args={[0.05, 0.6, 0.02]} />
                 <meshStandardMaterial color="#5c4033" />
               </mesh>
               {/* Pouch */}
               <mesh position={[0, -0.3, 0]}>
                 <sphereGeometry args={[0.08, 16, 16]} />
                 <meshStandardMaterial color="#3e2723" />
               </mesh>
               {/* Wrist Strap */}
               <mesh position={[0, 0.25, -0.05]} rotation={[0.2, 0, 0]}>
                  <boxGeometry args={[0.04, 0.3, 0.01]} />
                  <meshStandardMaterial color="#4e342e" />
               </mesh>
            </group>
    
            {/* Weapon: Knife (Attached to Right Arm) */}
            <group ref={knifeRef} position={[0, -0.6, 0.1]} rotation={[Math.PI/2, 0, 0]}>
               {/* Handle */}
               <mesh position={[0, -0.1, 0]}>
                 <cylinderGeometry args={[0.03, 0.04, 0.2, 8]} />
                 <meshStandardMaterial color="#3e2723" />
               </mesh>
               {/* Blade */}
               <mesh position={[0, 0.15, 0]}>
                 <boxGeometry args={[0.05, 0.3, 0.01]} />
                 <meshStandardMaterial color="#cfd8dc" metalness={0.8} roughness={0.2} />
               </mesh>
            </group>
        </group>

        {/* Legs - Pivot at hip */}
        <group ref={leftLeg} position={[-0.15, 0.5, 0]}>
            <mesh castShadow position={[0, -0.4, 0]}>
                <capsuleGeometry args={[0.09, 0.8, 8, 16]} />
                <meshStandardMaterial color="#ffcd94" />
            </mesh>
            {/* Sandal */}
            <mesh castShadow position={[0, -0.8, 0.05]}>
                <boxGeometry args={[0.12, 0.05, 0.25]} />
                <meshStandardMaterial color="#5c4033" />
            </mesh>
            {/* Sandal Straps */}
            <mesh position={[0, -0.75, 0.08]} rotation={[0.2, 0, 0]}>
                <boxGeometry args={[0.1, 0.01, 0.01]} />
                <meshStandardMaterial color="#3E2723" />
            </mesh>
            <mesh position={[0, -0.7, 0.06]} rotation={[0.2, 0, 0]}>
                <boxGeometry args={[0.1, 0.01, 0.01]} />
                <meshStandardMaterial color="#3E2723" />
            </mesh>
        </group>

        <group ref={rightLeg} position={[0.15, 0.5, 0]}>
            <mesh castShadow position={[0, -0.4, 0]}>
                <capsuleGeometry args={[0.09, 0.8, 8, 16]} />
                <meshStandardMaterial color="#ffcd94" />
            </mesh>
            {/* Sandal */}
            <mesh castShadow position={[0, -0.8, 0.05]}>
                <boxGeometry args={[0.12, 0.05, 0.25]} />
                <meshStandardMaterial color="#5c4033" />
            </mesh>
            {/* Sandal Straps */}
            <mesh position={[0, -0.75, 0.08]} rotation={[0.2, 0, 0]}>
                <boxGeometry args={[0.1, 0.01, 0.01]} />
                <meshStandardMaterial color="#3E2723" />
            </mesh>
            <mesh position={[0, -0.7, 0.06]} rotation={[0.2, 0, 0]}>
                <boxGeometry args={[0.1, 0.01, 0.01]} />
                <meshStandardMaterial color="#3E2723" />
            </mesh>
        </group>
      </group>
    </RigidBody>
  );
}
