# Ruta Infinita

Juego de plataformas 2D sin dependencias. Abre `index.html` en un navegador o publica el repositorio con GitHub Pages.

## Controles

- `←` / `→` o `A` / `D`: desplazarse.
- `↑` o `Espacio`: saltar obstáculos.
- `↓` o `S`: agacharse.
- `Tab`: pausar o reanudar la partida.
- `M`: activar o silenciar los efectos.
- `R`: reiniciar tras perder.

También hay controles táctiles para izquierda, salto y derecha.

## Sistema de juego

- Cinco capas con parallax: cielo, edificios, arbustos, suelo y objetos jugables.
- Puntos por distancia y 100 puntos por cada moneda.
- Obstáculos que terminan la partida si no se saltan.
- Puntuación máxima guardada localmente en el navegador.
- Sonidos de salto, moneda, pausa y golpe generados en el navegador; no requiere descargar ni licenciar efectos externos.

El mapa no se almacena completo. Cada tramo usa la misma semilla en `randomAt()`, por lo que los edificios, monedas y obstáculos se recrean al entrar en pantalla sin aumentar la memoria con el tiempo.
