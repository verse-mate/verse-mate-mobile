import Svg, { Path, type SvgProps } from 'react-native-svg';

export const IconProfile = (props: SvgProps) => (
  <Svg width={48} height={48} viewBox="0 0 48 48" fill="none" {...props}>
    <Path
      d="M36 40C36 36.8174 34.7357 33.7652 32.4853 31.5147C30.2348 29.2643 27.1826 28 24 28M24 28C20.8174 28 17.7652 29.2643 15.5147 31.5147C13.2643 33.7652 12 36.8174 12 40M24 28C28.4183 28 32 24.4183 32 20C32 15.5817 28.4183 12 24 12C19.5817 12 16 15.5817 16 20C16 24.4183 19.5817 28 24 28ZM44 24C44 35.0457 35.0457 44 24 44C12.9543 44 4 35.0457 4 24C4 12.9543 12.9543 4 24 4C35.0457 4 44 12.9543 44 24Z"
      stroke={props.color || 'white'}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
