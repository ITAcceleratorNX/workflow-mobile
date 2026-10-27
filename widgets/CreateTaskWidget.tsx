import { AccessoryWidgetBackground, HStack, Image, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { font, lineLimit, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

type CreateTaskWidgetProps = {
  ready: boolean;
};

function CreateTaskWidget(_props: CreateTaskWidgetProps, environment: WidgetEnvironment) {
  'widget';
  const url = 'workflowmobile://widget/task/create';
  const link = widgetURL(url);
  if (environment.widgetFamily === 'accessoryCircular') {
    return (
      <ZStack modifiers={[link]}>
        <AccessoryWidgetBackground />
        <Image systemName="plus" size={22} />
      </ZStack>
    );
  }
  return (
    <HStack alignment="center" spacing={8} modifiers={[link]}>
      <Image systemName="plus.circle.fill" size={20} />
      <VStack alignment="leading" spacing={1}>
        <Text modifiers={[font({ size: 15, weight: 'bold' }), lineLimit(1)]}>Создать задачу</Text>
        <Text modifiers={[font({ size: 11, weight: 'medium' }), lineLimit(1)]}>Workflow</Text>
      </VStack>
    </HStack>
  );
}

export default createWidget('CreateTaskWidget', CreateTaskWidget);
