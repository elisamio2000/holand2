import Autocomplete, {
  locationAtom,
  type Location,
} from '../google-map/autocomplete';
import { useSetAtom } from 'jotai';

export default function GoogleMap() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY?.trim();
  if (!apiKey) {
    return (
      <div className="flex h-[500px] w-full items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
        Google Maps is disabled (no external API). Use the offline map modules instead.
      </div>
    );
  }

  const setLocation = useSetAtom(locationAtom);

  const handlePlaceSelect = (place: Location) => {
    setLocation({
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    });
  };

  return (
    <Autocomplete
      apiKey={apiKey}
      onPlaceSelect={handlePlaceSelect}
      className="relative h-[500px] w-full flex-grow rounded-lg bg-gray-50"
      inputProps={{
        size: 'lg',
        type: 'text',
        rounded: 'pill',
        placeholder: 'Search for a location',
        className: 'absolute z-10 flex-grow block right-7 left-7 top-7',
        inputClassName: 'bg-white dark:bg-gray-100 border-0',
      }}
      mapClassName="rounded-lg"
    />
  );
}
