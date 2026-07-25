import { useEffect, useState } from 'react';
import { Image } from 'antd';
import { baixarBlobUrl } from '../api';

// Exibe uma imagem protegida por JWT: busca via axios (com token) como blob
// e renderiza a object-URL. Assim evitamos o 401 do <img src> nativo.
export function AuthImage({
  anexoId,
  width = 120,
  height = 120,
}: {
  anexoId: number;
  width?: number;
  height?: number;
}) {
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    let objectUrl: string | undefined;
    let ativo = true;
    baixarBlobUrl(`/anexos/${anexoId}/download`)
      .then((url) => {
        objectUrl = url;
        if (ativo) setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [anexoId]);

  return (
    <Image
      width={width}
      height={height}
      style={{ objectFit: 'cover', borderRadius: 6 }}
      src={src}
    />
  );
}
