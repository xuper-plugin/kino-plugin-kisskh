# Kino plugin: KissKH

Doramas, series y películas asiáticas, y anime, con subtítulos en varios idiomas, en una sola pestaña de Kino
(Inicio, Dramas, Películas, Anime y mosaicos por género). **Sin torrents**: solo enlaces de reproducción directa.

## Instalar

En Kino, Plugins ▸ Agregar plugin, y escribe:

```
xuper-plugin/kino-plugin-kisskh
```

## Qué hace

- **Búsqueda** global y dentro de cada página "Ver más".
- **Sección KissKH** con pestañas Inicio, Dramas, Películas y Anime, y mosaicos por género.
- **Episodios y detalles** de cada título; **descargas** para ver sin conexión.
- **Subtítulos** descifrados e incluidos en el reproductor; el idioma preferido se activa primero.
- Si el enlace firmado del video falla, se usa una página oculta del navegador como alternativa.

## Ajustes

- **Idioma de subtítulos**: inglés o español.
- **Calidad máxima**: automática, hasta 1080p, 720p o 480p (ahorra datos).
- **Reproducir siempre con el navegador**: solo si los capítulos no abren de la forma normal.
- **Filas en Inicio**: muestra o esconde las novedades de KissKH en el Inicio de Kino.
- **Estado**: dice si el catálogo y la reproducción respondieron; botones para probar, borrar la caché y
  restablecer preferencias.

## Desarrollo

```
npm run build      # genera plugin.js
npm test           # pruebas sin red, con un kino simulado
npm run validate   # compila y revisa el manifiesto con el SDK
```

El manifiesto se firma y se publica aparte (lo hace la persona dueña del plugin).

## Licencia

Ver `LICENSE` y `NOTICE`.
