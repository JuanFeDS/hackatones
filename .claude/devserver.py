"""Servidor estático de desarrollo que desactiva la caché del navegador."""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class ManejadorSinCache(SimpleHTTPRequestHandler):
    """Sirve archivos estáticos con cabeceras que impiden cachearlos."""

    def end_headers(self):
        """Añade Cache-Control antes de cerrar las cabeceras."""
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


def main():
    """Arranca el servidor en el puerto y la carpeta recibidos por argumento."""
    puerto = int(sys.argv[1])
    carpeta = sys.argv[2]
    manejador = partial(ManejadorSinCache, directory=carpeta)
    ThreadingHTTPServer(("", puerto), manejador).serve_forever()


if __name__ == "__main__":
    main()
