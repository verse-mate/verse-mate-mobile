import { useId } from 'react';
import Svg, { G, Mask, Path, Rect, type SvgProps } from 'react-native-svg';

export const IconTrash = (props: SvgProps) => {
  const maskId = useId();
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
      <Mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <Rect width="24" height="24" fill="#D9D9D9" />
      </Mask>
      <G mask={`url(#${maskId})`}>
        <Path
          d="M7.6155 20C7.168 20 6.78683 19.8426 6.472 19.528C6.15733 19.2131 6 18.832 6 18.3845V5.99996H5V4.99996H9V4.23071H15V4.99996H19V5.99996H18V18.3845C18 18.8448 17.8458 19.2291 17.5375 19.5375C17.2292 19.8458 16.8448 20 16.3845 20H7.6155ZM17 5.99996H7V18.3845C7 18.564 7.05767 18.7115 7.173 18.827C7.2885 18.9423 7.436 19 7.6155 19H16.3845C16.5385 19 16.6796 18.9359 16.8077 18.8077C16.9359 18.6795 17 18.5385 17 18.3845V5.99996ZM9.80775 17H10.8078V7.99996H9.80775V17ZM13.1923 17H14.1923V7.99996H13.1923V17Z"
          fill={props.color || 'black'}
        />
      </G>
    </Svg>
  );
};
