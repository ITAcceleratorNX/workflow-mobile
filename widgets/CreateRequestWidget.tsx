import { AccessoryWidgetBackground, HStack, Image, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { font, lineLimit, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

type CreateRequestWidgetProps = {
  ready: boolean;
};

function CreateRequestWidget(_props: CreateRequestWidgetProps, environment: WidgetEnvironment) {
  'widget';
  const url = 'workflowmobile://widget/request/create';
  const link = widgetURL(url);
  if (environment.widgetFamily === 'accessoryCircular') {
    return (
      <ZStack modifiers={[link]}>
        <AccessoryWidgetBackground />
        <Image systemName="doc.text.fill" size={20} />
      </ZStack>
    );
  }
  return (
    <HStack alignment="center" spacing={8} modifiers={[link]}>
      <Image systemName="doc.text.fill" size={20} />
      <VStack alignment="leading" spacing={1}>
        <Text modifiers={[font({ size: 15, weight: 'bold' }), lineLimit(1)]}>Создать заявку</Text>
        <Text modifiers={[font({ size: 11, weight: 'medium' }), lineLimit(1)]}>Сервис</Text>
      </VStack>
    </HStack>
  );
}

export default createWidget('CreateRequestWidget', CreateRequestWidget);
