import { MaterialIcons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { useProductUi } from '@/hooks/use-product-ui';

type RowPosition = { y: number; height: number };

export type SurveySortableListRenderProps = {
  index: number;
  dragHandle: React.ReactNode;
};

export type SurveySortableListProps<T> = {
  data: readonly T[];
  keyExtractor: (item: T, index: number) => string;
  onReorder: (items: T[]) => void;
  renderItem: (props: SurveySortableListRenderProps & { item: T }) => React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

type SortableRowProps<T> = {
  item: T;
  index: number;
  itemKey: string;
  renderItem: SurveySortableListProps<T>['renderItem'];
  onLayout: (itemKey: string, event: LayoutChangeEvent) => void;
  onDrop: (itemKey: string, translationY: number) => void;
};

function SortableRow<T>({ item, index, itemKey, renderItem, onLayout, onDrop }: SortableRowProps<T>) {
  const ui = useProductUi();
  const dragY = useSharedValue(0);
  const gesture = Gesture.Pan()
    .activateAfterLongPress(180)
    .minDistance(5)
    .onUpdate((event) => { dragY.value = event.translationY; })
    .onEnd((event) => { runOnJS(onDrop)(itemKey, event.translationY); })
    .onFinalize(() => { dragY.value = 0; });
  const translatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
    zIndex: dragY.value === 0 ? 1 : 10,
    elevation: dragY.value === 0 ? 0 : 8,
  }));
  const dragHandle = (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Переместить, элемент ${index + 1}`}
        accessibilityHint="Удерживайте и перемещайте вверх или вниз, чтобы изменить порядок"
        style={styles.dragHandle}
      >
        <MaterialIcons name="drag-indicator" size={18} color={ui.fg(0.42)} />
      </Animated.View>
    </GestureDetector>
  );

  return (
    <Animated.View onLayout={(event) => onLayout(itemKey, event)} style={[translatedStyle, styles.row]}>
      {renderItem({ item, index, dragHandle })}
    </Animated.View>
  );
}

/** Touch-driven reorder for the compact question and option lists in the mobile survey editor. */
export function SurveySortableList<T>({ data, keyExtractor, onReorder, renderItem, style }: SurveySortableListProps<T>) {
  const positions = useRef(new Map<string, RowPosition>());
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  const onLayout = useCallback((itemKey: string, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    positions.current.set(itemKey, { y, height });
  }, []);

  const onDrop = useCallback((itemKey: string, translationY: number) => {
    const items = [...dataRef.current];
    const from = items.findIndex((item, index) => keyExtractor(item, index) === itemKey);
    const source = positions.current.get(itemKey);
    if (from < 0 || !source || translationY === 0) return;

    const centerY = source.y + source.height / 2 + translationY;
    const to = items.findIndex((item, index) => {
      const position = positions.current.get(keyExtractor(item, index));
      return position != null && centerY < position.y + position.height / 2;
    });
    const target = to < 0 ? items.length - 1 : to;
    if (from === target) return;
    const [moved] = items.splice(from, 1);
    items.splice(target, 0, moved);
    onReorder(items);
  }, [keyExtractor, onReorder]);

  return (
    <View style={style}>
      {data.map((item, index) => {
        const itemKey = keyExtractor(item, index);
        return (
          <SortableRow
            key={itemKey}
            item={item}
            index={index}
            itemKey={itemKey}
            renderItem={renderItem}
            onLayout={onLayout}
            onDrop={onDrop}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { zIndex: 1 },
  dragHandle: { minWidth: 22, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
});
