import Svg, { Path, type SvgProps } from 'react-native-svg';

export const IconHighlight = (props: SvgProps) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
    <Path
      d="M9 11L3 17V20H12L15 17M22 12L17.4 16.6C17.0261 16.9665 16.5235 17.1717 16 17.1717C15.4765 17.1717 14.9739 16.9665 14.6 16.6L9.4 11.4C9.03355 11.0261 8.82829 10.5235 8.82829 10C8.82829 9.47649 9.03355 8.97386 9.4 8.6L14 4"
      stroke={props.color || 'black'}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
