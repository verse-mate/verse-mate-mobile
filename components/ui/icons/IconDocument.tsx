import { useId } from 'react';
import Svg, { G, Mask, Path, Rect, type SvgProps } from 'react-native-svg';

export const IconDocument = (props: SvgProps) => {
  const maskId = useId();
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
      <Mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <Rect width="24" height="24" fill="#D9D9D9" />
      </Mask>
      <G mask={`url(#${maskId})`}>
        <Path
          d="M8.5 17.5L15.5 17.5L15.5 16.5L8.5 16.5L8.5 17.5ZM8.5 13.5L15.5 13.5L15.5 12.5L8.5 12.5L8.5 13.5ZM6.6155 21C6.15517 21 5.77083 20.8458 5.4625 20.5375C5.15417 20.2292 5 19.8448 5 19.3845L5 4.6155C5 4.15517 5.15417 3.77083 5.4625 3.4625C5.77083 3.15417 6.15517 3 6.6155 3L14.5 3L19 7.5L19 19.3845C19 19.8448 18.8458 20.2292 18.5375 20.5375C18.2292 20.8458 17.8448 21 17.3845 21L6.6155 21ZM14 8L14 4L6.6155 4C6.4615 4 6.32042 4.06408 6.19225 4.19225C6.06408 4.32042 6 4.4615 6 4.6155L6 19.3845C6 19.5385 6.06408 19.6796 6.19225 19.8078C6.32042 19.9359 6.4615 20 6.6155 20L17.3845 20C17.5385 20 17.6796 19.9359 17.8077 19.8078C17.9359 19.6796 18 19.3845 18 8L14 8Z"
          fill={props.color || '#1C1B1F'}
        />
      </G>
    </Svg>
  );
};
