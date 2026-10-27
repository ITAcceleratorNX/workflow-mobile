import { HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import { font, lineLimit, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type NearestTaskWidgetProps = {
  eyebrow: string;
  title: string;
  inline: string;
  url: string;
};

function NearestTaskWidget(props: NearestTaskWidgetProps, environment: WidgetEnvironment) {
  'widget';
  const family = environment.widgetFamily;
  const link = widgetURL(props.url);
  if (family === 'accessoryInline') {
    return <Text modifiers={[font({ size: 14, weight: 'semibold' }), lineLimit(1), link]}>{props.inline}</Text>;
  }
  return (
    <VStack alignment="leading" spacing={2} modifiers={[link]}>
      <HStack spacing={6}>
        <Image systemName="checklist" size={14} />
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), lineLimit(1)]}>{props.eyebrow}</Text>
      </HStack>
      <Text modifiers={[font({ size: 15, weight: 'bold' }), lineLimit(2)]}>{props.title}</Text>
    </VStack>
  );
}

export default createWidget('NearestTaskWidget', NearestTaskWidget);
