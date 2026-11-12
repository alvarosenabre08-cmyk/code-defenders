# Code Defenders: The Production Release

Tower Defense cooperativo en tiempo real para 1-4 jugadores. Canvas 2D vectorial, sin imágenes.
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
- Uno crea la sala y pasa el código de 4 letras; los demás se unen (máximo 4).
- CPU (dinero) y vida del servidor son compartidas. Cualquiera puede construir, mejorar, vender o mover cualquier torre.
- Cada torre tiene **3 ramas de evolución de 3 niveles** (estilo Bloons TD6): solo se pueden mejorar 2 ramas y solo una llega a nivel 3. Cada mejora cambia el ataque y el aspecto.
- **Chat de texto**: `Enter` para escribir (en la sala de espera y en la partida).
- Teclas: `1-8` elegir torre · clic colocar (`Mayús`+clic para varias) · `U`/`I`/`O` mejorar rama 1/2/3 · `X` vender · `M` mover · `Tab` siguiente torre · `Espacio` siguiente oleada · `A` oleadas automáticas · `P` pausa global · `H` ayuda · `Esc` cancelar.
- 20 oleadas; jefe *Merge Conflict* en las oleadas 5, 10, 15 y 20.

## Cómo funciona por dentro
- El navegador del **anfitrión** (quien crea la sala) ejecuta la simulación y publica el estado ~7 veces por segundo.
  Los demás envían sus acciones y dibujan lo que reciben. Si el anfitrión se va, el jugador más antiguo hereda la partida.
- El anfitrión debería dejar la pestaña del juego visible (en segundo plano el navegador la ralentiza).

| Archivo | Qué hace |
|---|---|
| `js/data.js` | Mapa, torres (con sus 3 ramas de mejoras), enemigos y oleadas. **Aquí se equilibra el juego.** |
| `js/sim.js` | Lógica del juego (sin DOM ni red). |
| `js/render.js` | Dibujo en Canvas. |
| `js/net.js` | Salas, acciones, cursores, chat y estado con Firebase. |
| `js/main.js` | Menús, HUD, ratón/teclado y unión de todo. |
| `js/firebase-config.js` | Tu configuración de Firebase. |
| `js/net-mock.js` | Solo para pruebas: abre `?mock` en dos pestañas del mismo navegador para probar sin Firebase. |
