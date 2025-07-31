import 'package:flutter/material.dart';
import '../Constants/colors.dart';

class ConsultationInput extends StatefulWidget {
  final String hintText;
  final VoidCallback? onSendPressed;
  final VoidCallback? onMicPressed;
  final TextEditingController? controller;
  final bool isRecording;

  const ConsultationInput({
    super.key,
    this.hintText = 'Escribe tu consulta legal aquí...',
    this.onSendPressed,
    this.onMicPressed,
    this.controller,
    this.isRecording = false,
  });

  @override
  State<ConsultationInput> createState() => _ConsultationInputState();
}

class _ConsultationInputState extends State<ConsultationInput> {
  late TextEditingController _controller;
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    _controller = widget.controller ?? TextEditingController();
    _controller.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    if (widget.controller == null) {
      _controller.dispose();
    }
    super.dispose();
  }

  void _onTextChanged() {
    setState(() {
      _hasText = _controller.text.trim().isNotEmpty;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.2),
            spreadRadius: 1,
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _controller,
              decoration: InputDecoration(
                hintText: widget.hintText,
                hintStyle: TextStyle(
                  color: Colors.grey[400],
                  fontSize: 16,
                ),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 8),
              ),
              maxLines: null,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) {
                if (_hasText) {
                  widget.onSendPressed?.call();
                }
              },
            ),
          ),
          const SizedBox(width: 12),
          // Botón de micrófono
          GestureDetector(
            onTap: widget.onMicPressed,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: widget.isRecording ? Colors.red : AppColors.buttonColor,
                shape: BoxShape.circle,
              ),
              child: Icon(
                widget.isRecording ? Icons.stop : Icons.mic,
                color: Colors.white,
                size: 24,
              ),
            ),
          ),
          const SizedBox(width: 8),
          // Botón de enviar
          if (_hasText)
            GestureDetector(
              onTap: widget.onSendPressed,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.buttonColor,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.send,
                  color: Colors.white,
                  size: 24,
                ),
              ),
            ),
        ],
      ),
    );
  }
} 