# Leones TD: Defensa de la Sabana

Tower Defense cooperativo en tiempo real para 1-4 jugadores, con 6 mapas. Gráficos estilo dibujo animado pintados por código en Canvas 2D (sin imágenes).
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
       },
       "cd_names": {
         "$uid": { ".read": true, ".write": "!data.exists()", ".validate": "newData.val() === true" }
       },
       "cd_users": {
         "$uid": {
           "$key": { ".read": true, ".write": true, ".validate": "$key.length === 64" }
         }
       }
     }
   }
   ```
   - `cd_rooms`: las salas de juego.
   - `cd_names`: qué nombres de usuario están cogidos (solo se pueden crear, no cambiar).
   - `cd_users`: el progreso de cada cuenta. Solo se puede leer conociendo la clave que sale del nombre + PIN.
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
- **Cuenta**: se entra con nombre de usuario + PIN de 4 números. El progreso se guarda en la cuenta (en Firebase), no en el ordenador.
- **Menú principal**: Jugar, Torres, Bolsa, Mazos, Misiones, Logros, Estadísticas y Perfil.
- Uno crea la sala, pasa el código de 4 letras y **elige el mapa**; los demás se unen (máximo 4).
- **Cada jugador tiene su propio oro, su color y sus torres**. Solo el dueño puede mejorar, vender o mover sus torres. Las vidas de la guarida son compartidas.
- **El oro de cada barril se reparte según el daño** que le hizo cada jugador. El daño de brasas, lava y explosiones de barril se reparte a partes iguales; la dinamita cuenta para quien la detona; si tu Tamborilero potencia la torre de otro, te llevas la mitad del daño extra. El oro inicial, el bonus de oleada y el de saltar oleada se reparten a partes iguales.
- **Si alguien se desconecta** se le guarda el sitio 2 minutos y sus torres siguen disparando. Al volver a entrar con su cuenta le sale **"Volver a la partida"** en el menú (también desde otro ordenador). Si no vuelve a tiempo, sus torres pasan al jugador con menos torres y su oro se reparte.
- **Donar oro**: clic en la ficha de un compañero (arriba) o tecla `G`, y eliges 50, 100, 250 o todo. Sale en el chat.
- **Marcadores**: `B` o clic central pone "construid aquí" (o "atacad este barril" si apuntas a uno, y lo sigue); `V` pone "¡ayuda!". Duran 5 s, en tu color. Uno cada 2 s.
- **Retos cooperativos**: en las oleadas 2, 5, 8, 11… y en todas las de jefe aparece un reto para todo el equipo (que no pase ningún barril, combos, habilidades, ralentizar, construir, calidades distintas, repartir el daño, romper el jefe a tiempo). Cumplido: oro para todos y +5 filetes cada uno al final.
- **Estadísticas de la partida**: tecla `E` (o botón Stats). Daño, eliminados, oro generado, ralentizados, curación y oro donado de cada jugador. Al terminar sale la pantalla de resultados con la mejor cifra de cada columna marcada con corona.
- **6 mapas**, cada uno más grande y difícil que el anterior (los grandes se dibujan encogidos para que se vean enteros):
  - *Sabana* (fácil, 20 oleadas): un camino largo, brasas, dinamita.
  - *Selva* (medio, 25): cruce con señal, cueva en la oleada 8, puente levadizo y río.
  - *Volcán* (difícil, 30): dos frentes, tótems de poder (+30% de daño), 75 vidas.
  - *Pantano* (muy difícil, 30, 36×18 casillas): 3 entradas. **Barro** (frena), **niebla** (los barriles solo los ven las torres con detección), **esclusas** que se abren con un clic y lo inundan todo 6 s, y una señal para mandarlos por el rodeo.
  - *Cañón* (extremo, 35, 40×20): 4 entradas. **Riscos** (+25% de alcance a la torre de encima), **viento** (acelera a los barriles), **desprendimientos** (una roca baja rodando y golpea a todo el tramo), puentes, río y lava.
  - *Ciudadela* (legendario, 40, 44×22): 5 entradas y la guarida en el centro. **Día y noche**: de noche las torres ven un 30% menos salvo cerca de una **antorcha** encendida. **Cañones** de la muralla que disparan al barril más fuerte y 2 señales que por defecto mandan a los barriles por el atajo.
- **20 torres en 4 calidades**. Se empieza con 8 (Arquero, Cañonero, Cuartel de Leonas, Mercader, Tamborilero, Cazador, Alquimista y Chamán); las otras 12 salen en cofres:
  - *Comunes*: León Hondero, León Pescador.
  - *Raras*: León Luchador, León Escarcha, León Bandido, León Halconero.
  - *Épicas*: León Catapulta, León Solar, León Verdugo.
  - *Legendarias* (1 por jugador): Rey León, León Fénix, León del Tiempo.
- **Filetes y cofres**: al acabar una partida se ganan filetes (3 por oleada superada, +40 por ganar; Selva x1,4 y Volcán x1,8). Un cofre cuesta 100 filetes y trae 1 torre: Común 55 %, Rara 30 %, Épica 12 %, Legendaria 3 %. Si pasan 9 cofres sin Épica o mejor, el décimo la trae seguro. Los cofres se pueden guardar en la **Bolsa** y abrir más tarde.
- **Niveles**: las torres repetidas son copias. Con 1, 2, 4 y 8 copias la torre sube a los niveles 2, 3, 4 y 5; cada nivel da +2,5 % de daño y alcance (nivel 5 = +10 %). Las copias de una torre al nivel 5 se cambian por filetes (10 / 20 / 50 / 150 según la calidad).
- **Mazos**: a cada partida se entra con un mazo de hasta 6 torres y solo se pueden construir esas. Se guardan hasta 5 mazos; se elige en *Mazos* o en la sala, donde se ven los mazos de todos. El mazo no se puede cambiar a mitad de partida.
- **Misiones**: 3 diarias (cambian a medianoche) y 3 semanales (cambian el lunes). Son las mismas para todos ese día. Avanzan al acabar cada partida (también en práctica) y al abrir cofres; al completarlas se reclaman los filetes en la pestaña Misiones.
- **Logros**: 28 logros permanentes. Cada uno da filetes una vez y una insignia. Las cuentas antiguas reciben al entrar los que ya tenían ganados.
- **Estadísticas**: partidas, victorias, barriles rotos (por ti y por la manada), daño, oro, torres, mejoras, habilidades, cofres, misiones, por mapa (partidas, victorias, mejor oleada) y las torres que más construyes.
- **Perfil**: nombre, insignia elegida (se ve junto a tu nombre en la sala) y torre favorita.
- **Mapa interactivo**: rocas y troncos que se pagan para quitar, dinamita, puentes levadizos, brasas/lava y río.
- **Mejoras 5-2-0**: cada torre tiene 3 ramas de 5 niveles. Máximo 2 ramas por torre (una hasta el nivel 5, la otra hasta el 2) y un solo nivel 5 de cada rama en el mapa. La rama 2 da una **habilidad** en el nivel 4.
- **Aspecto de las mejoras**: cada rama viste al león de una forma distinta. Rama 1 (fuerza): collar, hombreras, armadura y casco, y al nivel 5 armadura de oro, cuernos y aura de fuego. Rama 2 (mística): cinta con pluma, bufanda, capa y gema, orbes flotantes, y al nivel 5 corona de gemas y círculo de runas. Rama 3 (rapidez): gafas, rayos pintados, alas y propulsores, y al nivel 5 doble par de alas y remolino de viento. Los cambios grandes llegan en los niveles 3 y 5, y el león crece. El arma de cada torre también cambia con su rama.
- **Calidad en el mapa y la tienda**: halo bajo la torre (Rara azul, Épica morado con chispas, Legendaria dorado que late) y brillo del mismo color en la tienda. Si un ordenador va justo (menos de ~40 fps), los halos y auras animados se apagan solos.
- **Barriles especiales**: camuflados, de hierro (blindados), voladores, musgosos (se reparan) y fantasmas.
- **Combos**: Descarga (mojado + rayo) y Explosión de aceite (aceitado + fuego).
- **Reliquias**: al empezar y tras cada Tonel gigante se elige 1 de 3 mejoras aleatorias para toda la partida.
- **Saltar oleada** da oro extra por los segundos que faltaban. **Velocidad** x1/x2/x4/x6 para todos.
- Teclas: `1-6` torre de tu mazo · `U`/`I`/`O` mejorar rama · `T` objetivo · `Q` habilidad · `X` vender / quitar obstáculo · `M` mover · `Tab` siguiente torre · `G` donar · `B`/`V` marcadores · `E` estadísticas · `Espacio` saltar oleada · `A` auto · `F` velocidad · `P` pausa · `Enter` chat · `H` ayuda.

## Cómo funciona por dentro
- El navegador del **anfitrión** (quien crea la sala) ejecuta la simulación y publica el estado ~7 veces por segundo.
  Los demás envían sus acciones y dibujan lo que reciben. Si el anfitrión se va, el jugador más antiguo hereda la partida.
- El anfitrión debería dejar la pestaña del juego visible (en segundo plano el navegador la ralentiza).

| Archivo | Qué hace |
|---|---|
| `js/data.js` | Mapas (caminos, entradas, objetos y tamaño de cada uno), torres (calidad + 3 ramas × 5 niveles), barriles, reliquias y oleadas. **Aquí se equilibra el juego.** |
| `js/sim.js` | Lógica del juego (sin DOM ni red). |
| `js/render.js` | Dibujo en Canvas: mapas, leones, barriles y efectos. |
| `js/net.js` | Salas, puestos de los jugadores, acciones, cursores, chat y estado con Firebase. |
| `js/account.js` | Cuentas: nombre + PIN, sesión y progreso guardado. |
| `js/meta.js` | Progreso entre partidas: filetes, cofres (probabilidades y seguro), niveles de torre y mazos. **Aquí se cambia lo que cuesta o da cada cosa.** |
| `js/home.js` | Pestañas Torres, Bolsa y Mazos del menú, y la animación de abrir cofres. |
| `js/goals.js` | Misiones (cuáles hay, objetivos y filetes), logros y estadísticas. **Aquí se añaden o cambian misiones y logros.** |
| `js/goals-ui.js` | Pestañas Misiones, Logros, Estadísticas y Perfil, las insignias dibujadas y los avisos. |
| `js/main.js` | Entrada, menú principal, sala, HUD, ratón/teclado y unión de todo. |
| `js/firebase-config.js` | Tu configuración de Firebase. |
| `js/net-mock.js` | Solo para pruebas: abre `?mock` en dos pestañas del mismo navegador para probar sin Firebase. |
