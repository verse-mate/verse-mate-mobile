import Svg, { Path, type SvgProps } from 'react-native-svg';

/**
 * Latin cross — the menu glyph for the Life of Jesus section.
 *
 * Drawn as a single path on the same 24x24 grid as the rest of the set so it
 * sits on the menu's baseline without any per-icon nudging. No mask/clip here:
 * unlike the Material-derived icons in this folder, the shape never reaches the
 * viewBox edge, so there is nothing to clip.
 */
export const IconCross = (props: SvgProps) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
    <Path
      d="M10.75 3h2.5v4.75H18v2.5h-4.75V21h-2.5V10.25H6v-2.5h4.75V3Z"
      fill={props.color || '#1C1B1F'}
    />
  </Svg>
);
