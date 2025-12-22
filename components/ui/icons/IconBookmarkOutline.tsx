import { useId } from 'react';
import Svg, { G, Mask, Path, Rect, type SvgProps } from 'react-native-svg';

export const IconBookmarkOutline = (props: SvgProps) => {
  const maskId = useId();
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
      <Mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <Rect width="24" height="24" fill="#D9D9D9" />
      </Mask>
      <G mask={`url(#${maskId})`}>
        <Path
          d="M6 19.5V5.6155C6 5.15517 6.15417 4.77083 6.4625 4.4625C6.77083 4.15417 7.15517 4 7.6155 4H16.3845C16.8448 4 17.2292 4.15417 17.5375 4.4625C17.8458 4.77083 18 5.15517 18 5.6155V19.5L12 16.923L6 19.5ZM7 17.95L12 15.8L17 17.95V5.6155C17 5.4615 16.9359 5.32042 16.8077 5.19225C16.6796 5.06408 16.5385 5 16.3845 5H7.6155C7.4615 5 7.32042 5.06408 7.19225 5.19225C7.06408 5.32042 7 5.4615 7 5.6155V17.95Z"
          fill={props.color || '#1C1B1F'}
        />
      </G>
    </Svg>
  );
};
