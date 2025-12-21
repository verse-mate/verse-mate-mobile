import { useId } from 'react';
import Svg, { G, Mask, Path, Rect, type SvgProps } from 'react-native-svg';

export const IconBookmarkFilled = (props: SvgProps) => {
  const maskId = useId();
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
      <Mask
        id={maskId}
        style={{ maskType: 'alpha' }}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="24"
        height="24"
      >
        <Rect width="24" height="24" fill="#D9D9D9" />
      </Mask>
      <G mask={`url(#${maskId})`}>
        <Path
          d="M5.5 20.25V5.30775C5.5 4.80258 5.675 4.375 6.025 4.025C6.375 3.675 6.80258 3.5 7.30775 3.5H16.6923C17.1974 3.5 17.625 3.675 17.975 4.025C18.325 4.375 18.5 4.80258 18.5 5.30775V20.25L12 17.4615L5.5 20.25Z"
          fill={props.color || 'black'}
        />
      </G>
    </Svg>
  );
};
