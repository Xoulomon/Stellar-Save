// Type declarations for vite-imagetools query transforms.
// ?format=webp&as=url returns the URL string for the converted image.
declare module '*?format=webp&as=url' {
  const src: string;
  export default src;
}
