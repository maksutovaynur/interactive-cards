export function makeRuntimeAssetUrl(path: string) {
  const documentUrl = window.location.href.split('#')[0];
  const baseUrl = documentUrl.endsWith('/') ? documentUrl : documentUrl.replace(/[^/]*$/, '');

  return new URL(path.replace(/^\/+/, ''), baseUrl).toString();
}

export function probeImage(url: string) {
  return new Promise<boolean>((resolve) => {
    const image = new Image();

    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = url;
  });
}
