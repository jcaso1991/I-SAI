import { useState } from "react";
import { Alert, Platform } from "react-native";
import { api } from "./api";

export function useNotasActions(onRefresh: () => Promise<void>) {
  const toggleMarcada = async (nota: any): Promise<boolean> => {
    const newVal = !nota.marcada;
    try {
      await api.updateNota(nota.id, { marcada: newVal });
      return true;
    } catch {
      onRefresh();
      return false;
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed =
      Platform.OS === "web"
        ? window.confirm("¿Borrar esta nota?")
        : await new Promise<boolean>((resolve) => {
            Alert.alert("Eliminar", "¿Borrar esta nota?", [
              { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
              { text: "Eliminar", style: "destructive", onPress: () => resolve(true) },
            ]);
          });
    if (!confirmed) return;
    try {
      await api.deleteNota(id);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
    onRefresh();
  };

  const cambiarFecha = async (id: string, newDate: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      Alert.alert("Formato", "Usa YYYY-MM-DD (ej: 2025-05-14)");
      return;
    }
    try {
      await api.updateNota(id, { fecha: newDate });
      onRefresh();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const guardarNota = async (body: any, existingId?: string): Promise<any> => {
    if (!body.titulo?.trim() && !body.contenido?.trim()) return null;
    try {
      if (existingId) {
        await api.updateNota(existingId, body);
        return existingId;
      } else {
        return await api.createNota(body);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
      return null;
    }
  };

  return { toggleMarcada, handleDelete, cambiarFecha, guardarNota };
}

export function useShareNota() {
  const [shareNota, setShareNota] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const openShare = async (nota: any) => {
    setShareNota(nota);
    setSelectedUsers([]);
    try {
      const users = await api.listUsers();
      setUsersList(users || []);
    } catch {
      setUsersList([]);
    }
  };

  const toggleUser = (uid: string) => {
    setSelectedUsers((p) =>
      p.includes(uid) ? p.filter((x) => x !== uid) : [...p, uid]
    );
  };

  const sendToChat = async () => {
    if (!shareNota || selectedUsers.length === 0) return;
    try {
      const body = shareNota.titulo || shareNota.contenido || "";
      const chat = await api.chatCreate({
        participant_ids: selectedUsers,
        name: shareNota.titulo?.slice(0, 50) || "Nota compartida",
      });
      await api.chatSend(chat.id, body);
      setShareNota(null);
      setSelectedUsers([]);
      Alert.alert("Enviado", "Nota compartida por chat.");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  return { shareNota, setShareNota, usersList, selectedUsers, openShare, toggleUser, sendToChat };
}
