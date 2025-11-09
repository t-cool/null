        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);
        
        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.set(4, 1.6, 4); // 最初の部屋に配置（中央付近）
        
        const renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);
        
        const roomSize = 10;
        const mazeSize = 5;
        
        // 迷路マップ (1=壁, 0=通路, 2=部屋) - 最適化された巨大迷宮
        const mazeLayout = [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,2,0,2,0,1,0,2,0,1,0,2,0,1,0,2,0,1,0,2,1],
            [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
            [1,2,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,1],
            [1,0,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1],
            [1,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,2,1],
            [1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,0,1],
            [1,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,1],
            [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
            [1,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,2,1],
            [1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1,0,1],
            [1,2,0,2,0,1,0,2,0,1,0,2,0,1,0,2,0,1,0,2,1],
            [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
            [1,2,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,1],
            [1,0,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1],
            [1,2,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,1],
            [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
            [1,2,0,2,0,1,0,2,0,1,0,2,0,1,0,2,0,1,0,2,1],
            [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
            [1,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,2,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
        ];
        
        // プレイヤーの状態
        let playerPos = { x: 4, z: 4 }; // 最初の部屋の位置（中央付近の部屋）
        let currentRoom = 1;
        let rooms = new Map();
        
        // マウス視線制御
        let mouseX = 0, mouseY = 0;
        let cameraRotationY = 0, cameraRotationX = 0;
        let isMouseDown = false;
        let mouseSensitivity = 0.002;
        
        // タッチ制御用
        let touchStartX = 0, touchStartY = 0;
        let isTouchDragging = false;
        let lastTouchTime = 0;
        let touchMoveVector = { x: 0, z: 0 };
        let isTouchMoving = false;
        const patternVertexShader = `
            varying vec2 vUv;
            varying vec3 vPosition;
            void main() {
                vUv = uv;
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        
        const patternFragmentShader = `
            uniform float time;
            uniform float intensity;
            uniform vec3 baseColor;
            uniform float roomTheme;
            varying vec2 vUv;
            varying vec3 vPosition;

            float noise(vec2 p) {
                return fract(sin(dot(p.xy, vec2(12.9898,78.233))) * 43758.5453);
            }

            float fbm(vec2 p) {
                float f = 0.0;
                f += 0.5000 * noise(p); p = p * 2.01;
                f += 0.2500 * noise(p); p = p * 2.02;
                f += 0.1250 * noise(p); p = p * 2.03;
                f += 0.0625 * noise(p);
                return f;
            }

            void main() {
                vec2 uv = vUv * 25.0; // 解像度をさらに上げる
                float t = time * 1.2 + roomTheme * 20.0; // 速度を上げる

                // より複雑なUV変形
                vec2 morphedUV = uv + vec2(
                    sin(uv.y * (8.0 + intensity * 4.0) + t) * 0.8 * intensity,
                    cos(uv.x * (6.0 + intensity * 3.0) + t * 2.5) * 0.8 * intensity
                ) + vec2(
                    sin(uv.x * 12.0 + t * 1.5) * 0.3,
                    cos(uv.y * 15.0 + t * 0.9) * 0.3
                );
                morphedUV += fbm(uv * 0.5 + t * 0.1) * 2.0 * intensity;

                float pattern1, pattern2, pattern3;

                // 部屋のテーマによってパターンを変更（催眠渦模様を強化）
                if (roomTheme < 1.0) {
                    // 無限に続く迷路のような渦
                    vec2 center = vec2(12.5, 12.5);
                    float angle = atan(morphedUV.y - center.y, morphedUV.x - center.x);
                    float radius = length(morphedUV - center);
                    
                    float spiral = angle * 2.0 + log(radius) * 8.0 - t * 4.0;
                    float hypnoticRings = sin(radius * 6.0 - t * 2.5) * 0.5 + 0.5;
                    float spiralWave = sin(spiral * 10.0 + sin(radius * 0.5 + t) * 2.0) * 0.5 + 0.5;
                    
                    pattern1 = mix(hypnoticRings, spiralWave, 0.7);
                    pattern2 = sin(angle * 18.0 + radius * 3.0 - t * 5.0) * cos(radius * 8.0 + t * 3.0);

                } else if (roomTheme < 2.0) {
                    // 多中心の無限渦
                    vec2 center1 = vec2(8.0, 8.0) + vec2(sin(t*0.3)*2.0, cos(t*0.4)*2.0);
                    vec2 center2 = vec2(17.0, 17.0) - vec2(cos(t*0.5)*2.0, sin(t*0.2)*2.0);
                    
                    float angle1 = atan(morphedUV.y - center1.y, morphedUV.x - center1.x);
                    float radius1 = length(morphedUV - center1);
                    float angle2 = atan(morphedUV.y - center2.y, morphedUV.x - center2.x);
                    float radius2 = length(morphedUV - center2);
                    
                    float spiral1 = sin(angle1 * 12.0 + radius1 * 4.0 - t * 5.0);
                    float spiral2 = cos(angle2 * 10.0 - radius2 * 3.5 + t * 4.5);
                    
                    pattern1 = (spiral1 + spiral2) * 0.6;
                    pattern2 = sin(radius1 * 7.0 - t * 3.5) * cos(radius2 * 5.0 + t * 2.5);

                } else if (roomTheme < 3.0) {
                    // グリッド状の迷路 + 渦
                     vec2 gridUV = fract(morphedUV * 0.5);
                    float gridPattern = (step(0.1, gridUV.x) - step(0.9, gridUV.x)) * (step(0.1, gridUV.y) - step(0.9, gridUV.y));
                    gridPattern = 1.0 - gridPattern;

                    float angle = atan(morphedUV.y - 12.5, morphedUV.x - 12.5);
                    float radius = length(morphedUV - vec2(12.5));
                    float spiralOverlay = sin(angle * 20.0 + radius * 2.0 - t * 6.0);

                    pattern1 = mix(gridPattern, spiralOverlay, 0.6 + intensity * 0.3);
                    pattern2 = fbm(morphedUV * 1.2 + t * 0.2) * step(0.4, mod(radius + t, 1.5));

                } else {
                    // 放射状の無限回廊
                    vec2 center = vec2(12.5, 12.5);
                    float angle = atan(morphedUV.y - center.y, morphedUV.x - center.x);
                    float radius = length(morphedUV - center);
                    
                    float radialLines = sin(angle * 32.0 + t * 3.0) * 0.5 + 0.5;
                    float concentricCircles = sin(pow(radius, 1.2) * 10.0 - t * 5.0) * 0.5 + 0.5;
                    float hypnoSpiral = sin(angle * 8.0 + radius * 2.0 - t * 4.0) * 0.5 + 0.5;
                    
                    pattern1 = mix(radialLines, concentricCircles, sin(t * 0.5) * 0.5 + 0.5);
                    pattern2 = mix(hypnoSpiral, fbm(morphedUV * 1.0 + t * 0.2), cos(t * 0.6) * 0.5 + 0.5);
                }
                
                pattern3 = sin(length(morphedUV - vec2(12.5)) * 20.0 - t * 7.0) * cos(length(morphedUV - vec2(2.5)) * 15.0 + t * 5.0);
                
                float noisePattern = fbm(morphedUV * 2.0 + t * 0.3) * 2.0 - 1.0;
                
                float kaleidoscope = sin(atan(morphedUV.y - 12.5, morphedUV.x - 12.5) * (16.0 + roomTheme * 5.0) + t * 5.0);
                kaleidoscope *= sin(length(morphedUV - vec2(12.5)) * 10.0 - t * 5.0) * cos(length(morphedUV - vec2(2.5)) * 8.0 + t * 4.0);
                
                float combined = (pattern1 + pattern2 + pattern3 + noisePattern + kaleidoscope) * 0.2;
                combined = smoothstep(-1.0, 1.0, combined);
                
                // 色の定義（紫を基調としたサイケデリックなパレット）
                vec3 color1, color2, color3, color4, color5, color6, color7, color8, color9, color10, color11, color12;

                if (roomTheme < 2.0) {
                    // テーマ1 & 2: 深紫、マゼンタ、ダークブルー
                    color1 = vec3(0.6, 0.1, 0.9); // ディープパープル
                    color2 = vec3(0.0, 0.0, 0.05); // ほぼ黒
                    color3 = vec3(1.0, 0.0, 0.8); // マゼンタ
                    color4 = vec3(0.2, 0.0, 0.4); // ダークバイオレット
                    color5 = vec3(0.05, 0.0, 0.1); // ほぼ黒
                    color6 = vec3(0.8, 0.2, 1.0); // ブライトラベンダー
                    color7 = vec3(0.0, 0.0, 0.0); // 黒
                    color8 = vec3(0.4, 0.1, 0.7); // ミッドナイトパープル
                    color9 = vec3(1.0, 0.3, 0.8); // ホットピンク
                    color10 = vec3(0.0, 0.0, 0.0); // 黒
                    color11 = vec3(0.5, 0.2, 1.0); // エレクトリックブルー
                    color12 = vec3(0.1, 0.1, 0.3); // ダークブルー
                } else {
                    // テーマ3 & 4: 紫、シアン、黒
                    color1 = vec3(0.0, 0.0, 0.0); // 黒
                    color2 = vec3(0.7, 0.0, 1.0); // ヘリオトロープ
                    color3 = vec3(0.0, 0.8, 1.0); // シアン
                    color4 = vec3(0.0, 0.0, 0.0); // 黒
                    color5 = vec3(0.3, 0.1, 0.5); // ダークパープル
                    color6 = vec3(0.9, 0.4, 1.0); // ライトマゼンタ
                    color7 = vec3(0.0, 0.0, 0.0); // 黒
                    color8 = vec3(0.0, 0.5, 0.8); // ダークシアン
                    color9 = vec3(1.0, 0.1, 0.7); // ショッキングピンク
                    color10 = vec3(0.0, 0.0, 0.0); // 黒
                    color11 = vec3(0.6, 0.2, 0.8); // インディゴ
                    color12 = vec3(0.2, 0.9, 0.9); // ターコイズ
                }
                
                float colorCycle = t * 4.0 + combined * 8.0 + roomTheme * 5.0; // 色変化を高速化
                float colorIndex = mod(colorCycle, 12.0);
                
                vec3 finalColor;
                if (colorIndex < 1.0) finalColor = mix(color1, color2, fract(colorIndex));
                else if (colorIndex < 2.0) finalColor = mix(color2, color3, fract(colorIndex));
                else if (colorIndex < 3.0) finalColor = mix(color3, color4, fract(colorIndex));
                else if (colorIndex < 4.0) finalColor = mix(color4, color5, fract(colorIndex));
                else if (colorIndex < 5.0) finalColor = mix(color5, color6, fract(colorIndex));
                else if (colorIndex < 6.0) finalColor = mix(color6, color7, fract(colorIndex));
                else if (colorIndex < 7.0) finalColor = mix(color7, color8, fract(colorIndex));
                else if (colorIndex < 8.0) finalColor = mix(color8, color9, fract(colorIndex));
                else if (colorIndex < 9.0) finalColor = mix(color9, color10, fract(colorIndex));
                else if (colorIndex < 10.0) finalColor = mix(color10, color11, fract(colorIndex));
                else if (colorIndex < 11.0) finalColor = mix(color11, color12, fract(colorIndex));
                else finalColor = mix(color12, color1, fract(colorIndex));
                
                if (baseColor.r < 0.01 && baseColor.g < 0.01 && baseColor.b < 0.01) {
                    finalColor = vec3(0.0, 0.0, 0.0);
                } else {
                    float saturation = 4.0 + intensity * 3.0;
                    vec3 grayScale = vec3(dot(finalColor, vec3(0.299, 0.587, 0.114)));
                    finalColor = mix(grayScale, finalColor, saturation);
                    
                    float wave1 = sin(uv.x * 20.0 + t * 5.0) * sin(uv.y * 15.0 + t * 4.0);
                    float wave2 = cos(uv.x * 12.0 - t * 4.5) * cos(uv.y * 25.0 + t * 5.5);
                    float extraPsych = (wave1 + wave2) * 0.5;
                    
                    float rainbow = sin(colorCycle * 1.0 + extraPsych * 2.5) * 0.5 + 0.5;
                    vec3 rainbowColor = vec3(
                        sin(rainbow * 6.28 * 2.5),
                        sin(rainbow * 6.28 * 2.5 + 2.09),
                        sin(rainbow * 6.28 * 2.5 + 4.19)
                    ) * 0.5 + 0.5;
                    
                    // 紫系のサイケデリックカラーミックス
                    vec3 psychColor1 = vec3(1.0, 0.0, 1.0); // マゼンタ
                    vec3 psychColor2 = vec3(0.5, 0.0, 1.0); // バイオレット
                    vec3 psychColor3 = vec3(0.0, 0.2, 1.0); // ブルー
                    vec3 psychColor4 = vec3(1.0, 0.2, 0.6); // ピンク
                    
                    float psychPhase = combined * 8.0 + t * 2.0;
                    vec3 psychMix1 = mix(
                        mix(psychColor1, psychColor2, sin(psychPhase) * 0.5 + 0.5),
                        mix(psychColor3, psychColor4, cos(psychPhase * 1.5) * 0.5 + 0.5),
                        sin(psychPhase * 0.8) * 0.5 + 0.5
                    );
                    
                    finalColor = mix(finalColor, rainbowColor, intensity * 0.7 + 0.2);
                    finalColor = mix(finalColor, psychMix1, 0.5 + intensity * 0.5);
                    finalColor = mix(finalColor, baseColor, 0.01);
                    
                    float brightness = 1.5 + intensity * 1.2 + combined * 1.0;
                    finalColor *= brightness;
                    
                    finalColor = max(finalColor, vec3(0.0, 0.0, 0.05));
                    
                    finalColor = clamp(finalColor, 0.0, 1.0);
                }
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;
        
        const mirrorVertexShader = `
            varying vec2 vUv;
            varying vec3 vWorldPosition;
            void main() {
                vUv = uv;
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        
        const mirrorFragmentShader = `
            uniform float time;
            uniform float intensity;
            uniform samplerCube envMap;
            varying vec2 vUv;
            varying vec3 vWorldPosition;
            
            void main() {
                vec3 viewDirection = normalize(vWorldPosition - cameraPosition);
                vec3 reflected = reflect(viewDirection, normalize(vWorldPosition));
                
                vec3 envColor = textureCube(envMap, reflected).rgb;
                
                float fresnel = pow(1.0 - abs(dot(normalize(vWorldPosition), viewDirection)), 2.0);
                
                vec3 baseReflection = mix(envColor, vec3(0.2, 0.4, 0.8), 0.3);
                
                float ripple = sin(length(vUv - vec2(0.5)) * 20.0 - time * 3.0) * 0.1 * intensity;
                baseReflection += vec3(ripple);
                
                gl_FragColor = vec4(baseReflection * (0.7 + fresnel * 0.3), 0.9);
            }
        `;
        
        // マテリアルプール - 同じパターンのマテリアルを再利用
        const materialPool = new Map();
        const sharedUniforms = {
            time: { value: 0 },
            intensity: { value: 0 }
        };
        
        function getMaterialKey(baseColor, roomTheme) {
            return `${baseColor.r}_${baseColor.g}_${baseColor.b}_${roomTheme}`;
        }
        
        function createPatternMaterial(baseColor, roomTheme) {
            const key = getMaterialKey(baseColor, roomTheme);
            
            // 既存のマテリアルがあれば再利用
            if (materialPool.has(key)) {
                return materialPool.get(key);
            }
            
            // 新しいマテリアルを作成
            const material = new THREE.ShaderMaterial({
                uniforms: {
                    time: sharedUniforms.time, // 共有uniform
                    intensity: sharedUniforms.intensity, // 共有uniform
                    baseColor: { value: baseColor },
                    roomTheme: { value: roomTheme }
                },
                vertexShader: patternVertexShader,
                fragmentShader: patternFragmentShader,
                side: THREE.DoubleSide
            });
            
            materialPool.set(key, material);
            return material;
        }
        
        const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256);
        const cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeRenderTarget);
        scene.add(cubeCamera);
        
        const mirrorMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                intensity: { value: 0 },
                envMap: { value: cubeRenderTarget.texture }
            },
            vertexShader: mirrorVertexShader,
            fragmentShader: mirrorFragmentShader,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        // 迷路構造を作成
        const cellSize = 4;
        const wallHeight = 4;
        const mazeGroup = new THREE.Group();
        scene.add(mazeGroup);
        
        // 共有ジオメトリ - 同じ形状を再利用
        const sharedFloorGeometry = new THREE.PlaneGeometry(cellSize, cellSize);
        const sharedWallGeometry = new THREE.PlaneGeometry(cellSize, wallHeight);
        const sharedBlockGeometry = new THREE.BoxGeometry(cellSize, wallHeight, cellSize);
        
        function createRoom(x, z, theme, mazeX, mazeZ, mazeData) {
            const roomGroup = new THREE.Group();
            
            // 床と天井は純粋な黒のマテリアルを使用
            const blackMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
            
            // 床
            const floor = new THREE.Mesh(sharedFloorGeometry, blackMaterial);
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(x * cellSize, -wallHeight / 2, z * cellSize);
            roomGroup.add(floor);
            
            // 天井（同じマテリアルを再利用）
            const ceiling = new THREE.Mesh(sharedFloorGeometry, blackMaterial);
            ceiling.rotation.x = Math.PI / 2;
            ceiling.position.set(x * cellSize, wallHeight / 2, z * cellSize);
            roomGroup.add(ceiling);
            
            // 壁を追加（部屋を立方体として認識できるように）
            // 各部屋の4面に壁を追加（通路がある方向は開ける）
            const wallColors = [
                new THREE.Vector3(0.8, 0.3, 0.5),
                new THREE.Vector3(0.3, 0.8, 0.5),
                new THREE.Vector3(0.5, 0.3, 0.8),
                new THREE.Vector3(0.8, 0.8, 0.3)
            ];
            
            // 迷路データから隣接セルをチェック
            const hasNorthOpening = mazeData && mazeZ > 0 && mazeData[mazeZ-1][mazeX] === 0;
            const hasSouthOpening = mazeData && mazeZ < mazeData.length-1 && mazeData[mazeZ+1][mazeX] === 0;
            const hasEastOpening = mazeData && mazeX < mazeData[0].length-1 && mazeData[mazeZ][mazeX+1] === 0;
            const hasWestOpening = mazeData && mazeX > 0 && mazeData[mazeZ][mazeX-1] === 0;
            
            // 北壁（通路がなければ設置）
            if (!hasNorthOpening) {
                const northWall = new THREE.Mesh(
                    sharedWallGeometry,
                    createPatternMaterial(wallColors[0], theme)
                );
                northWall.position.set(x * cellSize, 0, (z - 0.5) * cellSize);
                roomGroup.add(northWall);
            }
            
            // 南壁（通路がなければ設置）
            if (!hasSouthOpening) {
                const southWall = new THREE.Mesh(
                    sharedWallGeometry,
                    createPatternMaterial(wallColors[1], theme)
                );
                southWall.position.set(x * cellSize, 0, (z + 0.5) * cellSize);
                southWall.rotation.y = Math.PI;
                roomGroup.add(southWall);
            }
            
            // 東壁（通路がなければ設置）
            if (!hasEastOpening) {
                const eastWall = new THREE.Mesh(
                    sharedWallGeometry,
                    createPatternMaterial(wallColors[2], theme)
                );
                eastWall.position.set((x + 0.5) * cellSize, 0, z * cellSize);
                eastWall.rotation.y = -Math.PI / 2;
                roomGroup.add(eastWall);
            }
            
            // 西壁（通路がなければ設置）
            if (!hasWestOpening) {
                const westWall = new THREE.Mesh(
                    sharedWallGeometry,
                    createPatternMaterial(wallColors[3], theme)
                );
                westWall.position.set((x - 0.5) * cellSize, 0, z * cellSize);
                westWall.rotation.y = Math.PI / 2;
                roomGroup.add(westWall);
            }
            
            return roomGroup;
        }
        
        function createWall(x, z, direction) {
            // 位置に基づいて決定的な色とテーマを生成（同じ位置の壁は常に同じ見た目）
            const seed = x * 1000 + z;
            const colorIndex = Math.abs(seed) % 5;
            const themeIndex = Math.abs(seed) % 4;
            
            // 事前定義された色パレット
            const colors = [
                new THREE.Vector3(0.6, 0.4, 0.8),
                new THREE.Vector3(0.8, 0.6, 0.4),
                new THREE.Vector3(0.4, 0.8, 0.6),
                new THREE.Vector3(0.7, 0.5, 0.7),
                new THREE.Vector3(0.5, 0.7, 0.8)
            ];
            
            const wallMaterial = createPatternMaterial(colors[colorIndex], themeIndex);
            const wall = new THREE.Mesh(sharedWallGeometry, wallMaterial);
            
            if (direction === 'north') {
                wall.position.set(x * cellSize, 0, (z - 0.5) * cellSize);
            } else if (direction === 'south') {
                wall.position.set(x * cellSize, 0, (z + 0.5) * cellSize);
                wall.rotation.y = Math.PI;
            } else if (direction === 'east') {
                wall.position.set((x + 0.5) * cellSize, 0, z * cellSize);
                wall.rotation.y = -Math.PI / 2;
            } else if (direction === 'west') {
                wall.position.set((x - 0.5) * cellSize, 0, z * cellSize);
                wall.rotation.y = Math.PI / 2;
            }
            
            return wall;
        }
        
        // エンドレス迷路のためのチャンク管理
        const chunkSize = mazeLayout[0].length;
        const loadedChunks = new Map();
        const renderDistance = 1; // プレイヤーの周囲1チャンク分をロード（パフォーマンス最適化）
        let roomCount = 1;
        
        function getChunkKey(chunkX, chunkZ) {
            return `${chunkX},${chunkZ}`;
        }
        
        function createMazeChunk(chunkX, chunkZ) {
            const chunkGroup = new THREE.Group();
            
            // メインの構造を作成
            for (let z = 0; z < mazeLayout.length; z++) {
                for (let x = 0; x < mazeLayout[z].length; x++) {
                    const cell = mazeLayout[z][x];
                    const worldX = chunkX * chunkSize + x - Math.floor(mazeLayout[0].length / 2);
                    const worldZ = chunkZ * chunkSize + z - Math.floor(mazeLayout.length / 2);
                    
                    if (cell === 2) { // 部屋
                        const room = createRoom(worldX, worldZ, (roomCount + chunkX + chunkZ) % 4, x, z, mazeLayout);
                        chunkGroup.add(room);
                        rooms.set(`${worldX},${worldZ}`, roomCount);
                        roomCount++;
                    } else if (cell === 1) { // 壁
                        // 位置に基づいて決定的なマテリアルを選択
                        const wallSeed = (worldX + chunkX * 100) * 1000 + (worldZ + chunkZ * 100);
                        const wallColorIndex = Math.abs(wallSeed) % 3;
                        const wallThemeIndex = Math.abs(wallSeed) % 4;
                        
                        const wallColors = [
                            new THREE.Vector3(0.3, 0.2, 0.4),
                            new THREE.Vector3(0.4, 0.3, 0.5),
                            new THREE.Vector3(0.5, 0.2, 0.3)
                        ];
                        
                        const wallBlock = new THREE.Mesh(
                            sharedBlockGeometry,
                            createPatternMaterial(wallColors[wallColorIndex], wallThemeIndex)
                        );
                        wallBlock.position.set(worldX * cellSize, 0, worldZ * cellSize);
                        chunkGroup.add(wallBlock);
                    }
                }
            }
            
            // 通路の壁を追加
            for (let z = 0; z < mazeLayout.length; z++) {
                for (let x = 0; x < mazeLayout[z].length; x++) {
                    const cell = mazeLayout[z][x];
                    const worldX = chunkX * chunkSize + x - Math.floor(mazeLayout[0].length / 2);
                    const worldZ = chunkZ * chunkSize + z - Math.floor(mazeLayout.length / 2);
                    
                    if (cell === 0) { // 通路
                        // 隣接セルをチェックして必要な壁を作成
                        if (z > 0 && mazeLayout[z-1][x] === 1) {
                            chunkGroup.add(createWall(worldX, worldZ, 'north'));
                        }
                        if (z < mazeLayout.length-1 && mazeLayout[z+1][x] === 1) {
                            chunkGroup.add(createWall(worldX, worldZ, 'south'));
                        }
                        if (x > 0 && mazeLayout[z][x-1] === 1) {
                            chunkGroup.add(createWall(worldX, worldZ, 'west'));
                        }
                        if (x < mazeLayout[z].length-1 && mazeLayout[z][x+1] === 1) {
                            chunkGroup.add(createWall(worldX, worldZ, 'east'));
                        }
                    }
                }
            }
            
            return chunkGroup;
        }
        
        function updateChunks() {
            const playerChunkX = Math.floor(camera.position.x / (cellSize * chunkSize));
            const playerChunkZ = Math.floor(camera.position.z / (cellSize * chunkSize));
            
            // 新しいチャンクをロード
            for (let dx = -renderDistance; dx <= renderDistance; dx++) {
                for (let dz = -renderDistance; dz <= renderDistance; dz++) {
                    const chunkX = playerChunkX + dx;
                    const chunkZ = playerChunkZ + dz;
                    const key = getChunkKey(chunkX, chunkZ);
                    
                    if (!loadedChunks.has(key)) {
                        const chunk = createMazeChunk(chunkX, chunkZ);
                        mazeGroup.add(chunk);
                        loadedChunks.set(key, chunk);
                    }
                }
            }
            
            // 遠いチャンクをアンロード
            for (const [key, chunk] of loadedChunks.entries()) {
                const [chunkX, chunkZ] = key.split(',').map(Number);
                const distance = Math.max(Math.abs(chunkX - playerChunkX), Math.abs(chunkZ - playerChunkZ));
                
                if (distance > renderDistance + 1) {
                    mazeGroup.remove(chunk);
                    loadedChunks.delete(key);
                }
            }
        }
        
        // 初期チャンクをロード
        updateChunks();
        
        // 幻想的なBGM
        let audioContext;
        let masterGain;
        let isAudioStarted = false;
        let ambientVoices = [];
        let rainSound = null;
        let waterSound = null;
        let dynamicOscillators = [];
        let movementIntensity = 0;
        let lastPosition = { x: 0, z: 0 };
        let frictionSounds = [];
        let isCollidingX = false;
        let isCollidingZ = false;
        let noiseGenerators = [];
        
        function initAudio() {
            if (isAudioStarted) return;
            
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioContext.createGain();
            masterGain.gain.value = 0.3;
            masterGain.connect(audioContext.destination);
            
            // アンビエント和音
            const frequencies = [130.81, 164.81, 196.00, 246.94, 293.66]; // C3, E3, G3, B3, D4
            
            frequencies.forEach((freq, index) => {
                const voice = createAmbientVoice(freq, index);
                ambientVoices.push(voice);
            });
            
            // 雨音と水音を追加
            rainSound = createRainSound();
            waterSound = createWaterSound();
            
            // 動的オシレーターを作成
            createDynamicOscillators();
            
            // 摩擦音システムを作成
            createFrictionSounds();
            
            // ノイズジェネレーターを作成
            createNoiseGenerators();
            
            isAudioStarted = true;
        }
        
        function createAmbientVoice(baseFreq, voiceIndex) {
            // オシレーター（基本波形）
            const osc1 = audioContext.createOscillator();
            const osc2 = audioContext.createOscillator();
            
            osc1.type = 'triangle';
            osc2.type = 'sine';
            
            // 少しデチューンして厚みを出す
            osc1.frequency.value = baseFreq;
            osc2.frequency.value = baseFreq * 1.007; // わずかにずらす
            
            // LFO（低周波振動）でビブラートを作る
            const lfo = audioContext.createOscillator();
            const lfoGain = audioContext.createGain();
            
            lfo.type = 'sine';
            lfo.frequency.value = 0.1 + voiceIndex * 0.05; // 各声部で異なる速度
            lfoGain.gain.value = 2; // ビブラートの深さ
            
            lfo.connect(lfoGain);
            lfoGain.connect(osc1.frequency);
            lfoGain.connect(osc2.frequency);
            
            // フィルター（音色を柔らかく）
            const filter1 = audioContext.createBiquadFilter();
            const filter2 = audioContext.createBiquadFilter();
            
            filter1.type = 'lowpass';
            filter1.frequency.value = 800 + voiceIndex * 200;
            filter1.Q.value = 1;
            
            filter2.type = 'lowpass';
            filter2.frequency.value = 600 + voiceIndex * 150;
            filter2.Q.value = 1;
            
            // ゲイン（音量制御）
            const voiceGain = audioContext.createGain();
            voiceGain.gain.value = 0.15 + Math.sin(voiceIndex) * 0.05;
            
            // ディレイエフェクト（エコー）
            const delay = audioContext.createDelay();
            const delayFeedback = audioContext.createGain();
            const delayMix = audioContext.createGain();
            
            delay.delayTime.value = 0.3 + voiceIndex * 0.1;
            delayFeedback.gain.value = 0.3;
            delayMix.gain.value = 0.4;
            
            // 接続
            osc1.connect(filter1);
            osc2.connect(filter2);
            
            filter1.connect(voiceGain);
            filter2.connect(voiceGain);
            
            voiceGain.connect(delay);
            delay.connect(delayFeedback);
            delayFeedback.connect(delay);
            delay.connect(delayMix);
            
            voiceGain.connect(masterGain);
            delayMix.connect(masterGain);
            
            // LFOでフィルターも変調
            const filterLfo = audioContext.createOscillator();
            const filterLfoGain = audioContext.createGain();
            
            filterLfo.type = 'sine';
            filterLfo.frequency.value = 0.05 + voiceIndex * 0.02;
            filterLfoGain.gain.value = 100;
            
            filterLfo.connect(filterLfoGain);
            filterLfoGain.connect(filter1.frequency);
            
            // 開始
            osc1.start();
            osc2.start();
            lfo.start();
            filterLfo.start();
            
            // 音量の変調（呼吸するような効果）
            function modulateVolume() {
                const now = audioContext.currentTime;
                const breathRate = 0.03 + voiceIndex * 0.01;
                const breathDepth = 0.1;
                const targetVolume = 0.15 + Math.sin(now * breathRate) * breathDepth;
                
                voiceGain.gain.setTargetAtTime(targetVolume, now, 1);
                
                setTimeout(modulateVolume, 100);
            }
            
            modulateVolume();
            
            // 音楽制御用オブジェクトを返す
            return {
                voiceGain: voiceGain,
                filter1: filter1,
                filter2: filter2,
                delay: delay,
                delayMix: delayMix
            };
        }
        
        function createRainSound() {
            // ホワイトノイズで雨音ベースを作る
            const bufferSize = audioContext.sampleRate * 2; // 2秒のバッファ
            const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            
            // ホワイトノイズ生成
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
            
            // ノイズソース
            const whiteNoise = audioContext.createBufferSource();
            whiteNoise.buffer = noiseBuffer;
            whiteNoise.loop = true;
            
            // 雨音用フィルター（高周波をカット）
            const rainFilter1 = audioContext.createBiquadFilter();
            rainFilter1.type = 'lowpass';
            rainFilter1.frequency.value = 3000;
            rainFilter1.Q.value = 1;
            
            const rainFilter2 = audioContext.createBiquadFilter();
            rainFilter2.type = 'highpass';
            rainFilter2.frequency.value = 500;
            rainFilter2.Q.value = 0.5;
            
            // 雨音用ゲイン
            const rainGain = audioContext.createGain();
            rainGain.gain.value = 0.12;
            
            // LFOで雨の強さを変調
            const rainLfo = audioContext.createOscillator();
            const rainLfoGain = audioContext.createGain();
            
            rainLfo.type = 'sine';
            rainLfo.frequency.value = 0.1;
            rainLfoGain.gain.value = 0.03;
            
            rainLfo.connect(rainLfoGain);
            rainLfoGain.connect(rainGain.gain);
            
            // 接続
            whiteNoise.connect(rainFilter1);
            rainFilter1.connect(rainFilter2);
            rainFilter2.connect(rainGain);
            rainGain.connect(masterGain);
            
            // 開始
            whiteNoise.start();
            rainLfo.start();
            
            return {
                rainGain: rainGain,
                rainFilter1: rainFilter1,
                rainFilter2: rainFilter2
            };
        }
        
        function createWaterSound() {
            // 水の流れる音（低周波ノイズ + ゆらぎ）
            const bufferSize = audioContext.sampleRate * 3; // 3秒のバッファ
            const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            
            // より滑らかなノイズ生成（水音用）
            let previous = 0;
            for (let i = 0; i < bufferSize; i++) {
                const raw = Math.random() * 2 - 1;
                output[i] = previous * 0.7 + raw * 0.3; // ローパス的な効果
                previous = output[i];
            }
            
            // 水音ソース
            const waterNoise = audioContext.createBufferSource();
            waterNoise.buffer = noiseBuffer;
            waterNoise.loop = true;
            
            // 水音用フィルター（より低域）
            const waterFilter1 = audioContext.createBiquadFilter();
            waterFilter1.type = 'lowpass';
            waterFilter1.frequency.value = 800;
            waterFilter1.Q.value = 2;
            
            const waterFilter2 = audioContext.createBiquadFilter();
            waterFilter2.type = 'highpass';
            waterFilter2.frequency.value = 100;
            waterFilter2.Q.value = 0.3;
            
            // 水音用ゲイン
            const waterGain = audioContext.createGain();
            waterGain.gain.value = 0.08;
            
            // 水の流れの変調
            const waterLfo1 = audioContext.createOscillator();
            const waterLfoGain1 = audioContext.createGain();
            
            waterLfo1.type = 'sine';
            waterLfo1.frequency.value = 0.05;
            waterLfoGain1.gain.value = 200;
            
            waterLfo1.connect(waterLfoGain1);
            waterLfoGain1.connect(waterFilter1.frequency);
            
            // 水音のリバーブ効果
            const waterDelay = audioContext.createDelay();
            const waterDelayGain = audioContext.createGain();
            const waterDelayFeedback = audioContext.createGain();
            
            waterDelay.delayTime.value = 0.15;
            waterDelayGain.gain.value = 0.3;
            waterDelayFeedback.gain.value = 0.4;
            
            // 接続
            waterNoise.connect(waterFilter1);
            waterFilter1.connect(waterFilter2);
            waterFilter2.connect(waterGain);
            
            waterGain.connect(waterDelay);
            waterDelay.connect(waterDelayFeedback);
            waterDelayFeedback.connect(waterDelay);
            waterDelay.connect(waterDelayGain);
            
            waterGain.connect(masterGain);
            waterDelayGain.connect(masterGain);
            
            // 開始
            waterNoise.start();
            waterLfo1.start();
            
            return {
                waterGain: waterGain,
                waterFilter1: waterFilter1,
                waterFilter2: waterFilter2,
                waterDelayGain: waterDelayGain
            };
        }
        
        function createDynamicOscillators() {
            // 動的に変化する追加音源（音階なし）
            const baseFrequencies = [80, 120, 160, 200]; // 低周波の基本周波数
            
            // 複数の動的オシレーターを作成
            for (let i = 0; i < 4; i++) {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                const filter = audioContext.createBiquadFilter();
                const panner = audioContext.createStereoPanner();
                
                osc.type = ['sine', 'triangle', 'sawtooth', 'square'][i % 4];
                osc.frequency.value = baseFrequencies[i];
                
                filter.type = 'lowpass';
                filter.frequency.value = 1000 + i * 500;
                filter.Q.value = 2;
                
                gain.gain.value = 0; // 最初は無音
                panner.pan.value = (i - 1.5) * 0.5; // ステレオ配置
                
                // LFOで音程を変調（音階ではなく連続的な変化）
                const lfo = audioContext.createOscillator();
                const lfoGain = audioContext.createGain();
                
                lfo.type = 'sine';
                lfo.frequency.value = 0.1 + i * 0.05;
                lfoGain.gain.value = baseFrequencies[i] * 0.3; // 基本周波数の30%の変調
                
                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);
                
                // ディレイエフェクト
                const delay = audioContext.createDelay();
                const delayGain = audioContext.createGain();
                const feedback = audioContext.createGain();
                
                delay.delayTime.value = 0.2 + i * 0.1;
                delayGain.gain.value = 0.3;
                feedback.gain.value = 0.2;
                
                // 接続
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(panner);
                panner.connect(delay);
                delay.connect(feedback);
                feedback.connect(delay);
                delay.connect(delayGain);
                
                panner.connect(masterGain);
                delayGain.connect(masterGain);
                
                // 開始
                osc.start();
                lfo.start();
                
                dynamicOscillators.push({
                    oscillator: osc,
                    gain: gain,
                    filter: filter,
                    panner: panner,
                    lfo: lfo,
                    lfoGain: lfoGain,
                    delay: delay,
                    delayGain: delayGain,
                    baseFreq: baseFrequencies[i]
                });
            }
        }
        
        function updateDynamicMusic() {
            if (!dynamicOscillators.length) return;
            
            const now = audioContext.currentTime;
            
            // 移動量を計算
            const deltaX = camera.position.x - lastPosition.x;
            const deltaZ = camera.position.z - lastPosition.z;
            const movement = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
            
            // 移動強度を更新（慣性付き）
            movementIntensity = movementIntensity * 0.9 + movement * 10;
            movementIntensity = Math.min(movementIntensity, 1.0);
            
            // 位置を更新
            lastPosition.x = camera.position.x;
            lastPosition.z = camera.position.z;
            
            // カメラの向きに基づいて音響効果を変更
            const normalizedRotation = (cameraRotationY + Math.PI) / (Math.PI * 2); // 0-1
            
            // 動的オシレーターの音量を常に0に設定（無効化）
            dynamicOscillators.forEach((oscData, index) => {
                if (!oscData.gain) return;
                
                // 音量を0に固定
                oscData.gain.gain.setTargetAtTime(0, now, 0.1);
            });
            
            // 移動に応じてランダムノイズを注入
            if (movementIntensity > 0.1) {
                triggerRandomNoise(movementIntensity);
            }
        }
        
        function createNoiseGenerators() {
            // 複数のノイズジェネレーターを作成
            for (let i = 0; i < 3; i++) {
                // ノイズバッファを作成
                const bufferSize = audioContext.sampleRate * 0.3; // 0.3秒のバッファ
                const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
                const output = noiseBuffer.getChannelData(0);
                
                // 異なるタイプのノイズを生成
                for (let j = 0; j < bufferSize; j++) {
                    if (i === 0) {
                        // ホワイトノイズ
                        output[j] = Math.random() * 2 - 1;
                    } else if (i === 1) {
                        // ピンクノイズ風
                        output[j] = (Math.random() * 2 - 1) * Math.pow(0.5, j % 100);
                    } else {
                        // グリッチノイズ
                        output[j] = (Math.random() > 0.8) ? Math.random() * 2 - 1 : 0;
                    }
                }
                
                // ノイズソース
                const noiseSource = audioContext.createBufferSource();
                noiseSource.buffer = noiseBuffer;
                noiseSource.loop = true;
                
                // フィルター
                const noiseFilter = audioContext.createBiquadFilter();
                noiseFilter.type = ['lowpass', 'bandpass', 'highpass'][i];
                noiseFilter.frequency.value = [1000, 2000, 4000][i];
                noiseFilter.Q.value = 2;
                
                // ゲイン（最初は無音）
                const noiseGain = audioContext.createGain();
                noiseGain.gain.value = 0;
                
                // パンニング
                const noisePanner = audioContext.createStereoPanner();
                noisePanner.pan.value = (i - 1) * 0.5; // -0.5, 0, 0.5
                
                // 接続
                noiseSource.connect(noiseFilter);
                noiseFilter.connect(noiseGain);
                noiseGain.connect(noisePanner);
                noisePanner.connect(masterGain);
                
                // 開始
                noiseSource.start();
                
                noiseGenerators.push({
                    source: noiseSource,
                    filter: noiseFilter,
                    gain: noiseGain,
                    panner: noisePanner,
                    type: i,
                    lastTrigger: 0
                });
            }
        }
        
        function triggerRandomNoise(intensity) {
            if (!noiseGenerators.length) return;
            
            const now = audioContext.currentTime;
            const currentTime = Date.now();
            
            // ランダムにノイズジェネレーターを選択
            const availableGenerators = noiseGenerators.filter(gen => 
                currentTime - gen.lastTrigger > 100 // 100ms間隔制限
            );
            
            if (availableGenerators.length === 0) return;
            
            const selectedGenerator = availableGenerators[Math.floor(Math.random() * availableGenerators.length)];
            selectedGenerator.lastTrigger = currentTime;
            
            // ノイズのパラメータをランダムに設定
            const duration = 0.05 + Math.random() * 0.2; // 0.05-0.25秒
            const volume = Math.min(intensity * 0.2 * Math.random(), 0.15);
            const filterFreq = 500 + Math.random() * 3000;
            
            // フィルター周波数をランダムに変更
            selectedGenerator.filter.frequency.setTargetAtTime(filterFreq, now, 0.01);
            
            // パンニングをランダムに変更
            const randomPan = (Math.random() - 0.5) * 1.5;
            selectedGenerator.panner.pan.setTargetAtTime(randomPan, now, 0.01);
            
            // 音量をフェードイン・フェードアウト
            selectedGenerator.gain.gain.setTargetAtTime(volume, now, 0.01);
            selectedGenerator.gain.gain.setTargetAtTime(0, now + duration, 0.05);
        }
        
        
        function createFrictionSounds() {
            // 複数の摩擦音を作成（方向別）
            for (let i = 0; i < 2; i++) {
                // ノイズベース
                const bufferSize = audioContext.sampleRate * 0.5; // 0.5秒のバッファ
                const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
                const output = noiseBuffer.getChannelData(0);
                
                // 摩擦音用の特殊なノイズ生成
                let previous = 0;
                for (let j = 0; j < bufferSize; j++) {
                    const raw = Math.random() * 2 - 1;
                    // より粗い質感のノイズ
                    const roughness = Math.sin(j * 0.01) * 0.5;
                    output[j] = previous * 0.3 + raw * 0.7 + roughness;
                    previous = output[j];
                }
                
                // ノイズソース
                const frictionNoise = audioContext.createBufferSource();
                frictionNoise.buffer = noiseBuffer;
                frictionNoise.loop = true;
                
                // 摩擦音用フィルター（中高域を強調）
                const frictionFilter1 = audioContext.createBiquadFilter();
                frictionFilter1.type = 'bandpass';
                frictionFilter1.frequency.value = 2000 + i * 1000;
                frictionFilter1.Q.value = 3;
                
                const frictionFilter2 = audioContext.createBiquadFilter();
                frictionFilter2.type = 'highpass';
                frictionFilter2.frequency.value = 1000;
                frictionFilter2.Q.value = 0.5;
                
                // 摩擦音用ゲイン
                const frictionGain = audioContext.createGain();
                frictionGain.gain.value = 0; // 最初は無音
                
                // 摩擦音の変調（ざらざら感）
                const frictionLfo = audioContext.createOscillator();
                const frictionLfoGain = audioContext.createGain();
                
                frictionLfo.type = 'square';
                frictionLfo.frequency.value = 20 + i * 10; // 速い変調
                frictionLfoGain.gain.value = 500;
                
                frictionLfo.connect(frictionLfoGain);
                frictionLfoGain.connect(frictionFilter1.frequency);
                
                // ディストーション効果（粗い音）
                const waveshaper = audioContext.createWaveShaper();
                const samples = 44100;
                const curve = new Float32Array(samples);
                const deg = Math.PI / 180;
                
                for (let j = 0; j < samples; j++) {
                    const x = (j * 2) / samples - 1;
                    curve[j] = ((3 + 20) * x * 20 * deg) / (Math.PI + 20 * Math.abs(x));
                }
                waveshaper.curve = curve;
                waveshaper.oversample = '4x';
                
                // ステレオパンニング
                const panner = audioContext.createStereoPanner();
                panner.pan.value = i === 0 ? -0.3 : 0.3;
                
                // 接続
                frictionNoise.connect(frictionFilter1);
                frictionFilter1.connect(frictionFilter2);
                frictionFilter2.connect(waveshaper);
                waveshaper.connect(frictionGain);
                frictionGain.connect(panner);
                panner.connect(masterGain);
                
                // 開始
                frictionNoise.start();
                frictionLfo.start();
                
                frictionSounds.push({
                    gain: frictionGain,
                    filter1: frictionFilter1,
                    filter2: frictionFilter2,
                    lfo: frictionLfo,
                    panner: panner,
                    waveshaper: waveshaper
                });
            }
        }
        
        function playFrictionSound(direction, intensity) {
            if (!frictionSounds.length) return;
            
            const soundIndex = direction === 'x' ? 0 : 1;
            const friction = frictionSounds[soundIndex];
            
            if (!friction || !friction.gain) return;
            
            const now = audioContext.currentTime;
            const volume = Math.min(intensity * 0.3, 0.2);
            
            // 摩擦音の音量を設定
            friction.gain.gain.setTargetAtTime(volume, now, 0.05);
            
            // フィルター周波数を調整（摩擦の激しさで変化）
            const filterFreq = 2000 + soundIndex * 1000 + intensity * 1500;
            friction.filter1.frequency.setTargetAtTime(filterFreq, now, 0.1);
            
            // 短時間後にフェードアウト
            friction.gain.gain.setTargetAtTime(0, now + 0.1, 0.1);
        }
        
        function updateFrictionSounds() {
            if (!frictionSounds.length) return;
            
            // 継続的な壁との接触をチェック
            const keys = {
                ArrowUp: keys.ArrowUp || keys.KeyW,
                ArrowDown: keys.ArrowDown || keys.KeyS,
                ArrowLeft: keys.ArrowLeft || keys.KeyA,
                ArrowRight: keys.ArrowRight || keys.KeyD
            };
            
            const now = audioContext.currentTime;
            
            // X方向の摩擦音
            if (isCollidingX && (keys.ArrowLeft || keys.ArrowRight)) {
                const friction = frictionSounds[0];
                if (friction && friction.gain) {
                    const targetVolume = 0.1 + movementIntensity * 0.1;
                    friction.gain.gain.setTargetAtTime(targetVolume, now, 0.05);
                }
            } else {
                const friction = frictionSounds[0];
                if (friction && friction.gain) {
                    friction.gain.gain.setTargetAtTime(0, now, 0.1);
                }
            }
            
            // Z方向の摩擦音
            if (isCollidingZ && (keys.ArrowUp || keys.ArrowDown)) {
                const friction = frictionSounds[1];
                if (friction && friction.gain) {
                    const targetVolume = 0.1 + movementIntensity * 0.1;
                    friction.gain.gain.setTargetAtTime(targetVolume, now, 0.05);
                }
            } else {
                const friction = frictionSounds[1];
                if (friction && friction.gain) {
                    friction.gain.gain.setTargetAtTime(0, now, 0.1);
                }
            }
        }
        
        // ユーザーインタラクションで音楽開始
        function startAudio() {
            if (!isAudioStarted) {
                initAudio();
            }
        }
        
        // 音楽をインタラクションに応じて更新
        function updateMusic() {
            if (!isAudioStarted || !audioContext) return;
            
            const now = audioContext.currentTime;
            
            // インタラクション強度に応じて音楽を変化
            ambientVoices.forEach((voice, index) => {
                if (voice && voice.voiceGain && voice.filter1 && voice.delayMix) {
                    // 音量を強度に応じて変化
                    const targetVolume = 0.15 + intensity * 0.1;
                    voice.voiceGain.gain.setTargetAtTime(targetVolume, now, 0.1);
                    
                    // フィルターを強度に応じて開く
                    const targetFreq = 600 + index * 150 + intensity * 400;
                    voice.filter1.frequency.setTargetAtTime(targetFreq, now, 0.2);
                    
                    // ディレイ（エコー）を強度に応じて増加
                    const targetDelayMix = 0.4 + intensity * 0.3;
                    voice.delayMix.gain.setTargetAtTime(targetDelayMix, now, 0.1);
                }
            });
            
            // 雨音を強度に応じて調整
            if (rainSound && rainSound.rainGain && rainSound.rainFilter1) {
                const targetRainVolume = 0.12 + intensity * 0.08;
                rainSound.rainGain.gain.setTargetAtTime(targetRainVolume, now, 0.2);
                
                // 雨の強さ（フィルター周波数）を調整
                const targetRainFreq = 3000 + intensity * 2000;
                rainSound.rainFilter1.frequency.setTargetAtTime(targetRainFreq, now, 0.3);
            }
            
            // 水音を強度に応じて調整
            if (waterSound && waterSound.waterGain && waterSound.waterFilter1) {
                const targetWaterVolume = 0.08 + intensity * 0.05;
                waterSound.waterGain.gain.setTargetAtTime(targetWaterVolume, now, 0.2);
                
                // 水の流れの速さ（フィルター周波数）を調整
                const targetWaterFreq = 800 + intensity * 300;
                waterSound.waterFilter1.frequency.setTargetAtTime(targetWaterFreq, now, 0.2);
                
                // 水音のエコーも強化
                if (waterSound.waterDelayGain) {
                    const targetWaterDelay = 0.3 + intensity * 0.2;
                    waterSound.waterDelayGain.gain.setTargetAtTime(targetWaterDelay, now, 0.1);
                }
            }
            
            // マスター音量も微調整
            const masterVolume = 0.35 + intensity * 0.15; // 雨と水音を考慮して少し上げる
            masterGain.gain.setTargetAtTime(masterVolume, now, 0.1);
            
            // 動的音楽を更新
            updateDynamicMusic();
        }
        
        
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        scene.add(ambientLight);
        
        const coloredLights = [];
        const lightColors = [0x00ffff, 0xff00ff, 0xffff00, 0x00ff00, 0xff8000, 0x8000ff, 0xff0080, 0x0080ff];
        for (let i = 0; i < 8; i++) {
            const light = new THREE.PointLight(lightColors[i], 3, 20);
            const angle = (i / 8) * Math.PI * 2;
            light.position.x = Math.cos(angle) * 4;
            light.position.z = Math.sin(angle) * 4;
            light.position.y = 2;
            scene.add(light);
            coloredLights.push(light);
        }
        
        let isActive = false;
        let intensity = 0;
        let time = 0;
        
        const intensityIndicator = document.getElementById('intensity-indicator');
        const intensityValue = document.getElementById('intensity-value');
        const roomIndicator = document.getElementById('room-value');
        const positionIndicator = document.getElementById('position-value');
        
        // 移動とコリジョン
        const moveSpeed = 0.15;
        const keys = {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false,
            KeyW: false,
            KeyS: false,
            KeyA: false,
            KeyD: false,
            ShiftLeft: false,
            ShiftRight: false,
            Space: false
        };

        // 飛行機能の状態管理
        let isFlying = false;
        let flyVelocityY = 0;
        let lastShiftTap = 0;
        const doubleTapThreshold = 300; // ミリ秒
        
        function isWalkable(x, z) {
            const mapX = Math.round(x / cellSize) + Math.floor(mazeLayout[0].length / 2);
            const mapZ = Math.round(z / cellSize) + Math.floor(mazeLayout.length / 2);
            
            // エンドレス迷路のために座標をラップ
            const wrappedMapX = ((mapX % mazeLayout[0].length) + mazeLayout[0].length) % mazeLayout[0].length;
            const wrappedMapZ = ((mapZ % mazeLayout.length) + mazeLayout.length) % mazeLayout.length;
            
            return mazeLayout[wrappedMapZ][wrappedMapX] !== 1;
        }
        
        function updatePlayerPosition() {
            // カメラの前方向ベクトルを計算
            const forward = new THREE.Vector3(0, 0, -1); // Three.jsのデフォルト前方向
            const right = new THREE.Vector3(1, 0, 0);    // Three.jsのデフォルト右方向

            // カメラのY軸回転を適用
            forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotationY);
            right.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotationY);

            // 飛行中は視線方向への移動を可能にする
            const lookForward = new THREE.Vector3(0, 0, -1);
            lookForward.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotationY);
            lookForward.applyAxisAngle(new THREE.Vector3(1, 0, 0), cameraRotationX);

            // 移動ベクトルを初期化
            let moveVector = new THREE.Vector3(0, 0, 0);

            // キー入力に応じて移動ベクトルを計算
            if (keys.ArrowUp || keys.KeyW) {
                if (isFlying) {
                    moveVector.add(lookForward.clone().multiplyScalar(moveSpeed)); // 飛行中は視線方向に前進
                } else {
                    moveVector.add(forward.clone().multiplyScalar(moveSpeed)); // 前進
                }
            }
            if (keys.ArrowDown || keys.KeyS) {
                if (isFlying) {
                    moveVector.add(lookForward.clone().multiplyScalar(-moveSpeed)); // 飛行中は視線方向に後退
                } else {
                    moveVector.add(forward.clone().multiplyScalar(-moveSpeed)); // 後退
                }
            }
            if (keys.ArrowLeft || keys.KeyA) {
                moveVector.add(right.clone().multiplyScalar(-moveSpeed)); // 左移動
            }
            if (keys.ArrowRight || keys.KeyD) {
                moveVector.add(right.clone().multiplyScalar(moveSpeed)); // 右移動
            }

            // 飛行中の垂直移動
            if (isFlying) {
                if (keys.Space) {
                    flyVelocityY = moveSpeed; // スペースで上昇
                } else if (keys.ShiftLeft || keys.ShiftRight) {
                    flyVelocityY = -moveSpeed; // Shiftで下降
                } else {
                    flyVelocityY *= 0.95; // 減速
                }
                moveVector.y = flyVelocityY;
            }

            // タッチ移動を追加（ドラッグ中でない場合のみ）
            if (!isTouchDragging && isTouchMoving) {
                // タッチ位置からの相対的な移動方向を計算
                const touchForward = forward.clone().multiplyScalar(touchMoveVector.z);
                const touchRight = right.clone().multiplyScalar(touchMoveVector.x);
                moveVector.add(touchForward);
                moveVector.add(touchRight);
            }

            // 飛行中は衝突判定を無視
            if (isFlying) {
                camera.position.x += moveVector.x;
                camera.position.y += moveVector.y;
                camera.position.z += moveVector.z;
                isCollidingX = false;
                isCollidingZ = false;
            } else {
                let newX = camera.position.x + moveVector.x;
                let newZ = camera.position.z + moveVector.z;

                // コリジョン検出（より細かく）
                const buffer = 1.5; // 壁との距離バッファ
                isCollidingX = false;
                isCollidingZ = false;

                if (isWalkable(newX, camera.position.z)) {
                    const nextMapX = Math.round(newX / cellSize) + Math.floor(mazeLayout[0].length / 2);
                    const currentMapZ = Math.round(camera.position.z / cellSize) + Math.floor(mazeLayout.length / 2);

                    if (nextMapX >= 0 && nextMapX < mazeLayout[0].length &&
                        currentMapZ >= 0 && currentMapZ < mazeLayout.length) {
                        camera.position.x = newX;
                    } else {
                        isCollidingX = true;
                    }
                } else {
                    isCollidingX = true;
                }

                if (isWalkable(camera.position.x, newZ)) {
                    const currentMapX = Math.round(camera.position.x / cellSize) + Math.floor(mazeLayout[0].length / 2);
                    const nextMapZ = Math.round(newZ / cellSize) + Math.floor(mazeLayout.length / 2);

                    if (nextMapZ >= 0 && nextMapZ < mazeLayout.length &&
                        currentMapX >= 0 && currentMapX < mazeLayout[0].length) {
                        camera.position.z = newZ;
                    } else {
                        isCollidingZ = true;
                    }
                } else {
                    isCollidingZ = true;
                }
            }
            
            // 現在の部屋を更新
            const roomKey = `${Math.round(camera.position.x / cellSize)},${Math.round(camera.position.z / cellSize)}`;
            if (rooms.has(roomKey)) {
                currentRoom = rooms.get(roomKey);
            }
            
            // プレイヤー位置を更新
            playerPos.x = camera.position.x;
            playerPos.z = camera.position.z;
            
            // UI更新
            roomIndicator.textContent = currentRoom;
            positionIndicator.textContent = `${Math.round(camera.position.x)}, ${Math.round(camera.position.z)} | Y:${Math.round(cameraRotationY * 180 / Math.PI)}°`;
        }
        
        function startEffect(event) {
            isActive = true;
            intensityIndicator.style.opacity = '1';
        }
        
        function stopEffect() {
            isActive = false;
            intensityIndicator.style.opacity = '0';
        }
        
        // マウス制御
        function onMouseMove(event) {
            if (document.pointerLockElement === renderer.domElement) {
                const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
                const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
                
                cameraRotationY -= movementX * mouseSensitivity;
                cameraRotationX -= movementY * mouseSensitivity; // 上下の方向を自然に修正
                
                // 縦回転を制限
                cameraRotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraRotationX));
            }
        }
        
        function onMouseDown(event) {
            // 音楽開始
            startAudio();
            
            // 右クリックの場合はポインターロックを要求
            if (event.button === 2 || event.button === 0) {
                renderer.domElement.requestPointerLock();
            }
            
            // 左クリックでエフェクト強化
            if (event.button === 0) {
                startEffect(event);
            }
        }
        
        function onMouseUp(event) {
            if (event.button === 0) {
                stopEffect();
            }
        }
        
        function onPointerLockChange() {
            if (document.pointerLockElement === renderer.domElement) {
                console.log('Pointer locked - move mouse to look around');
                document.addEventListener('mousemove', onMouseMove, false);
            } else {
                console.log('Pointer unlocked');
                document.removeEventListener('mousemove', onMouseMove, false);
            }
        }
        
        // マウスイベント
        renderer.domElement.addEventListener('mousedown', onMouseDown);
        renderer.domElement.addEventListener('mouseup', onMouseUp);
        renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault()); // 右クリックメニューを無効化
        
        document.addEventListener('pointerlockchange', onPointerLockChange, false);
        document.addEventListener('mozpointerlockchange', onPointerLockChange, false);
        document.addEventListener('webkitpointerlockchange', onPointerLockChange, false);
        
        // タッチイベント
        function onTouchStart(event) {
            event.preventDefault();
            
            // 音楽開始
            startAudio();
            
            if (event.touches.length === 1) {
                const touch = event.touches[0];
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
                lastTouchTime = Date.now();
                isTouchMoving = true;
                
                // タップ位置に基づいて移動方向を設定
                const screenCenterX = window.innerWidth / 2;
                const screenCenterY = window.innerHeight / 2;
                const screenHeight = window.innerHeight;
                const screenWidth = window.innerWidth;
                
                // 画面の上半分・下半分・左右で判定
                if (touch.clientY < screenHeight * 0.4) {
                    // 上部タップ：前進
                    touchMoveVector.x = 0;
                    touchMoveVector.z = moveSpeed;
                } else if (touch.clientY > screenHeight * 0.6) {
                    // 下部タップ：後退
                    touchMoveVector.x = 0;
                    touchMoveVector.z = -moveSpeed;
                } else if (touch.clientX < screenWidth * 0.3) {
                    // 左側タップ：左移動
                    touchMoveVector.x = -moveSpeed;
                    touchMoveVector.z = 0;
                } else if (touch.clientX > screenWidth * 0.7) {
                    // 右側タップ：右移動
                    touchMoveVector.x = moveSpeed;
                    touchMoveVector.z = 0;
                } else {
                    // 中央タップ：前進
                    touchMoveVector.x = 0;
                    touchMoveVector.z = moveSpeed;
                }
                
                startEffect(event);
            }
        }
        
        function onTouchMove(event) {
            event.preventDefault();
            
            if (event.touches.length === 1) {
                const touch = event.touches[0];
                const currentTime = Date.now();
                const deltaTime = currentTime - lastTouchTime;
                
                // ドラッグ距離を計算
                const dragDistance = Math.sqrt(
                    Math.pow(touch.clientX - touchStartX, 2) + 
                    Math.pow(touch.clientY - touchStartY, 2)
                );
                
                if (dragDistance > 30) { // 30ピクセル以上動いたらドラッグとみなす
                    isTouchDragging = true;
                    isTouchMoving = false;
                    touchMoveVector.x = 0;
                    touchMoveVector.z = 0;
                    
                    // ドラッグで視点を回転
                    const deltaX = touch.clientX - touchStartX;
                    const deltaY = touch.clientY - touchStartY;
                    
                    cameraRotationY -= deltaX * mouseSensitivity * 2; // タッチは感度を上げる
                    cameraRotationX -= deltaY * mouseSensitivity * 2;
                    
                    // 縦回転を制限
                    cameraRotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraRotationX));
                    
                    touchStartX = touch.clientX;
                    touchStartY = touch.clientY;
                }
            }
        }
        
        function onTouchEnd(event) {
            event.preventDefault();
            isTouchDragging = false;
            isTouchMoving = false;
            touchMoveVector.x = 0;
            touchMoveVector.z = 0;
            stopEffect();
        }
        
        renderer.domElement.addEventListener('touchstart', onTouchStart);
        renderer.domElement.addEventListener('touchmove', onTouchMove);
        renderer.domElement.addEventListener('touchend', onTouchEnd);
        renderer.domElement.addEventListener('touchcancel', onTouchEnd);
        
        // キーボードイベント
        document.addEventListener('keydown', (event) => {
            if (keys.hasOwnProperty(event.code)) {
                keys[event.code] = true;
                event.preventDefault();

                // Shiftキーのダブルタップ検出
                if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
                    const currentTime = Date.now();
                    if (currentTime - lastShiftTap < doubleTapThreshold) {
                        isFlying = !isFlying; // 飛行モードの切り替え
                        if (!isFlying) {
                            // 飛行モードを解除した時は地面の高さに戻す
                            camera.position.y = 1.6;
                            flyVelocityY = 0;
                        }
                        console.log('飛行モード:', isFlying ? 'ON' : 'OFF');
                    }
                    lastShiftTap = currentTime;
                }
            }

            // ESCでポインターロック解除
            if (event.code === 'Escape') {
                document.exitPointerLock();
            }
        });
        
        document.addEventListener('keyup', (event) => {
            if (keys.hasOwnProperty(event.code)) {
                keys[event.code] = false;
                event.preventDefault();
            }
        });
        
        // フォーカス確保
        document.addEventListener('click', () => {
            document.body.focus();
        });
        
        // 初期フォーカス
        window.addEventListener('load', () => {
            document.body.focus();
            
            // モバイルデバイスの検出とUI調整
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isMobile) {
                document.querySelector('.desktop-controls').style.display = 'none';
                document.querySelector('.mobile-controls').style.display = 'inline';
            }
        });
        
        function animate() {
            requestAnimationFrame(animate);
            
            time += 0.016;
            updatePlayerPosition();
            updateChunks(); // エンドレス迷路のチャンク管理
            updateMusic(); // 幻想的な音楽更新
            
            if (isActive) {
                intensity = Math.min(1.0, intensity + 0.02);
            } else {
                intensity = Math.max(0, intensity - 0.01);
            }
            
            intensityValue.textContent = Math.round(intensity * 100);
            
            // 共有uniformsを更新（すべてのマテリアルが自動的に更新される）
            sharedUniforms.time.value = time;
            sharedUniforms.intensity.value = intensity;
            
            
            coloredLights.forEach((light, index) => {
                const angle = (index / coloredLights.length) * Math.PI * 2 + time * 0.8;
                light.position.x = Math.cos(angle) * (6 + Math.sin(time * 2 + index) * 3);
                light.position.z = Math.sin(angle) * (6 + Math.cos(time * 2 + index) * 3);
                light.position.y = 2 + Math.sin(time * 3 + index) * 1;
                light.intensity = 2 + intensity * 3 + Math.sin(time * 6 + index) * 1;
                
                // ライトの色を動的に変化させる
                const colorShift = time * 2 + index * 0.5;
                const r = Math.sin(colorShift) * 0.5 + 0.5;
                const g = Math.sin(colorShift + 2.09) * 0.5 + 0.5;
                const b = Math.sin(colorShift + 4.19) * 0.5 + 0.5;
                light.color.setRGB(r, g, b);
            });
            
            // カメラの回転を適用
            camera.rotation.order = 'YXZ';
            camera.rotation.y = cameraRotationY;
            camera.rotation.x = cameraRotationX;
            
            // カメラの微細な揺れ（移動中は無効、飛行中も考慮）
            const hasMovement = keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight ||
                               keys.KeyW || keys.KeyS || keys.KeyA || keys.KeyD;
            if (!isFlying && !hasMovement && !document.pointerLockElement) {
                camera.position.y = 1.6 + Math.sin(time * 0.15) * 0.05 * intensity;
                camera.rotation.y += Math.sin(time * 0.05) * 0.002 * intensity;
                camera.rotation.x += Math.cos(time * 0.07) * 0.001 * intensity;
            } else if (!isFlying && !hasMovement) {
                camera.position.y = 1.6;
            }
            
            cubeCamera.position.copy(camera.position);
            cubeCamera.update(renderer, scene);
            
            renderer.render(scene, camera);
        }
        
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
        
        animate();
