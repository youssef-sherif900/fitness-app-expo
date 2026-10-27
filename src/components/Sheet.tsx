import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useTheme } from '@/theme/tokens';

/** Bottom sheet used for serving pickers, log editing and meal naming. */
export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { c, radius } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Keep the sheet above the keyboard so its primary action is always tappable. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
          <View
            style={{
              backgroundColor: c.bg,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: 16,
              paddingBottom: 32,
              gap: 12,
              maxHeight: '88%',
            }}
          >
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
