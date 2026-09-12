# Rubín en Guadalajara

Juego de plataformas 2D sin dependencias protagonizado por Rubín. Explora una Guadalajara infinita y recarga su energía mientras recorres la ciudad.

## Controles

- `←` / `→` o `A` / `D`: desplazarse.
- `↑` o `Espacio`: saltar obstáculos.
- `↓` o `S`: agacharse.
- `Tab`: pausar o reanudar la partida.
- `M`: activar o silenciar los efectos.
- `R`: reiniciar tras perder.

También hay controles táctiles para izquierda, salto y derecha.

## Sistema de juego

- Cinco capas con parallax: cielo, ciudad distante, monumentos, jacarandas, paseo y objetos jugables.
- Panorama original en estilo 3D juguete de la Catedral Metropolitana, Hospicio Cabañas, La Minerva y los Arcos del Milenio.
- Nubes PNG realistas y capas panorámicas solapadas, para que la ciudad se desplace de forma continua sin cortes visibles.
- Puntos por distancia y 100 puntos por cada célula de energía.
- Macetas de agave y estuches de mariachi como obstáculos; un salto tiene margen de seguridad para que sea justo.
- Puntuación máxima guardada localmente en el navegador.
- Sonidos de salto, moneda, pausa y golpe generados en el navegador; no requiere descargar ni licenciar efectos externos.

El mapa no se almacena completo. Cada tramo usa la misma semilla en `randomAt()`, por lo que los edificios, monedas y obstáculos se recrean al entrar en pantalla sin aumentar la memoria con el tiempo.

## Otro juego: Rubín · Esferas de Color

Abre [`color-sorter/`](color-sorter/) para jugar una misión de clasificación: mueve a Rubín con las flechas, toma una esfera con `Espacio` y colócala en el recipiente del mismo color. `↑` y `↓` hacen que mire y gire la cabeza; sus brazos, expresiones y rueda se animan según la acción.
