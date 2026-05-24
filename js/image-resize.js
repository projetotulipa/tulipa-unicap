// TULIPA · helper compartilhado: redimensiona imagem client-side pra quadrado.
// Usa canvas pra reduzir antes do upload — economiza storage e padroniza dimensões.

const DEFAULT_SIZE = 400;
const DEFAULT_QUALITY = 0.85;

/**
 * Recebe um File (foto vinda de input[type=file]), retorna um Blob/File
 * quadrado SIZExSIZE JPEG. Faz crop centralizado se a imagem não for quadrada.
 */
export function resizeImageToSquare(file, size = DEFAULT_SIZE, quality = DEFAULT_QUALITY) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      return reject(new Error('Arquivo precisa ser uma imagem.'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Falha ao decodificar imagem'));
      img.onload = () => {
        const sourceMin = Math.min(img.width, img.height);
        const sx = (img.width - sourceMin) / 2;
        const sy = (img.height - sourceMin) / 2;

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, sourceMin, sourceMin, 0, 0, size, size);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Falha ao gerar blob'));
            // mantém metadados como File pra preservar contentType
            const out = new File([blob], (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(out);
          },
          'image/jpeg',
          quality
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Valida tamanho máximo (após resize) — default 1MB
export function validateImageSize(file, maxBytes = 1024 * 1024) {
  if (file.size > maxBytes) {
    throw new Error(`Imagem grande demais (${(file.size / 1024 / 1024).toFixed(2)}MB). Máximo ${(maxBytes / 1024 / 1024).toFixed(0)}MB.`);
  }
  return true;
}
