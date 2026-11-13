# Code Defenders: The Production Release

Tower Defense cooperativo en tiempo real para 1-4 jugadores, con 3 mapas. Canvas 2D vectorial, sin imágenes.
Se aloja igual que Haxball Turbo: **GitHub → Vercel**, con **Firebase Realtime Database** para el multijugador.
No hay nada que instalar ni compilar: son archivos estáticos.

## Puesta en marcha (una sola vez)

### 1. Firebase (proyecto nuevo)
1. Entra en https://console.firebase.google.com → **Agregar proyecto** (Analytics no hace falta).
2. Menú **Compilación → Realtime Database → Crear base de datos** (ubicación: Bélgica/europe-west1, modo bloqueado).
3. Pestaña **Reglas**, pega esto y pulsa **Publicar**:
   ```json
   {
     "rules": {
       "cd_rooms": {
         "$room": { ".read": true, ".write": true }
       }
     }
   }
   ```
4. Rueda dentada → **Configuración del proyecto → Tus apps → icono `</>` (Web)** → registra la app.
5. Copia el objeto `firebaseConfig` que te muestra y pégalo en `js/firebase-config.js`.
   Tiene que llevar la línea `databaseURL`. Si no aparece, cópiala de la página de Realtime Database
   (es la URL que acaba en `.firebasedatabase.app` o `.firebaseio.com`).

### 2. GitHub
1. Crea un repositorio nuevo (por ejemplo `code-defenders`).
2. **Add file → Upload files** y arrastra TODO el contenido de esta carpeta (`index.html`, `style.css`, `README.md` y la carpeta `js`).
3. Commit.

### 3. Vercel
1. https://vercel.com → **Add New → Project** → importa el repositorio.
2. Framework Preset: **Other**. No toques nada más → **Deploy**.
3. Cada vez que edites un archivo en GitHub, Vercel lo vuelve a publicar solo.

## Cómo se juega
- Uno crea la sala, pasa el código de 4 letras y **elige el mapa**; los demás se unen (máximo 4).
- CPU (dinero) y vida del servidor son compartidas. Cualquiera puede construir, mejorar, vender o mover cualquier torre.
- **3 mapas**: *Localhost* (fácil, 20 oleadas), *Staging* (medio, 25: router para desviar el tráfico, segundo puerto en la oleada 8) y *Producción* (difícil, 30: dos frentes, racks de GPU, 75 de vida).
- **Mapa interactivo**: código legacy que se paga para eliminar, bombas lógicas, ventanas de mantenimiento que cierran el paso, zonas de sobrecalentamiento y de refrigerante.
- **Mejoras 5-2-0**: cada torre tiene 3 ramas de 5 tiers. Máximo 2 ramas por torre (una hasta Tier 5, la otra hasta Tier 2) y un solo Tier 5 de cada rama en el mapa. La rama 2 da una **habilidad activa** en Tier 4.
- **Enemigos especiales**: ofuscados (Rootkit), blindados (Ransomware), voladores (Zero-Day) y regenerativos (Memory Leak).
- **Combos**: Cortocircuito (refrigerado + electricidad) y Stack Overflow (enredado + fuego).
- **Parches**: al empezar y tras cada jefe se elige 1 de 3 mejoras aleatorias para toda la partida.
- **Saltar oleada** da CPU extra por los segundos que faltaban. **Velocidad** x1/x2/x4/x6 para todos.
- Teclas: `1-8` torre · `U`/`I`/`O` mejorar rama · `T` objetivo · `Q` habilidad · `X` vender / eliminar legacy · `M` mover · `Tab` siguiente torre · `Espacio` saltar oleada · `A` auto · `F` velocidad · `P` pausa · `Enter` chat · `H` ayuda.

## Cómo funciona por dentro
- El navegador del **anfitrión** (quien crea la sala) ejecuta la simulación y publica el estado ~7 veces por segundo.
  Los demás envían sus acciones y dibujan lo que reciben. Si el anfitrión se va, el jugador más antiguo hereda la partida.
- El anfitrión debería dejar la pestaña del juego visible (en segundo plano el navegador la ralentiza).

| Archivo | Qué hace |
|---|---|
| `js/data.js` | Mapas, torres (3 ramas × 5 tiers), enemigos, parches y oleadas. **Aquí se equilibra el juego.** |
| `js/sim.js` | Lógica del juego (sin DOM ni red). |
| `js/render.js` | Dibujo en Canvas. |
| `js/net.js` | Salas, acciones, cursores, chat y estado con Firebase. |
| `js/main.js` | Menús, HUD, ratón/teclado y unión de todo. |
| `js/firebase-config.js` | Tu configuración de Firebase. |
| `js/net-mock.js` | Solo para pruebas: abre `?mock` en dos pestañas del mismo navegador para probar sin Firebase. |
