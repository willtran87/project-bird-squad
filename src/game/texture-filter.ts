import type Phaser from 'phaser';

/** Phaser 4 reuploads pixels when setFilter is called, even for the same mode.
 * Inspect the current sources rather than caching a key: replacement textures,
 * data textures and genuine mode changes must still be handled normally. */
export function setTextureFilter(texture: Phaser.Textures.Texture,
  mode: Parameters<Phaser.Textures.Texture['setFilter']>[0]) {
  if ([...texture.source, ...texture.dataSource].some(source => source.scaleMode !== mode)) texture.setFilter(mode);
  return texture;
}
