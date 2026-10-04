'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LockerTransaction {
  id: string;
  locker_id: number;
  item_description: string;
  depositor_name: string;
  depositor_contact: string;
  security_question: string | null;
  security_answer: string | null;
  otp: string | null;
  otp_generated_at: string | null;
  user_id: string | null;
  deposited_at: string;
  collected_at: string | null;
  collector_user_id?: string | null;
  collector_name?: string | null;
  collector_contact?: string | null;
  status: string;
  created_at: string;
  image_url: string | null;
  locked_by?: string | null;
  locked_until?: string | null;
  lock_reason?: string | null;
}

export const useLockerTransactions = () => {
  const [transactions, setTransactions] = useState<LockerTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    const { data, error } = await supabase
      .from('locker_transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      return;
    }

    setTransactions(data || []);
    setLoading(false);
  };

  // Get active transactions (deposited, not collected)
  const getActiveTransactions = () => {
    return transactions.filter(t => t.status === 'deposited');
  };

  // Get transaction by locker id
  const getTransactionByLocker = (lockerId: number) => {
    return transactions.find(t => t.locker_id === lockerId && t.status === 'deposited');
  };

  useEffect(() => {
    fetchTransactions();

    // Set up realtime subscription with a unique channel name to prevent double-subscription errors in React Strict Mode
    const channel = supabase.channel(`locker-transactions-${Date.now()}-${Math.random()}`);
    
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'locker_transactions'
      },
      () => {
        fetchTransactions();
      }
    );
    
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const createDeposit = async (data: {
    locker_id: number;
    item_description: string;
    depositor_name: string;
    depositor_contact: string;
    security_question?: string;
    security_answer?: string;
    otp?: string | null;
    user_id?: string;
    image_base64?: string | null;
  }) => {
    let imageUrl: string | null = null;

    // Upload image to storage if provided
    if (data.image_base64) {
      try {
        // Convert base64 to blob
        const base64Data = data.image_base64.split(',')[1] || data.image_base64;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/jpeg' });

        // Generate unique filename
        const fileName = `${data.user_id || 'anonymous'}/${Date.now()}-locker-${data.locker_id}.jpg`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('locker-items')
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
            upsert: false
          });

        if (uploadError) {
          console.error('Error uploading image:', uploadError);
        } else {
          // Get public URL
          const { data: urlData } = supabase.storage
            .from('locker-items')
            .getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
        }
      } catch (err) {
        console.error('Error processing image:', err);
      }
    }

    const { data: newTransaction, error } = await supabase
      .from('locker_transactions')
      .insert({
        locker_id: data.locker_id,
        item_description: data.item_description,
        depositor_name: data.depositor_name,
        depositor_contact: data.depositor_contact,
        security_question: data.security_question || null,
        security_answer: data.security_answer || null,
        otp: data.otp || null,
        otp_generated_at: null,
        user_id: data.user_id || null,
        status: 'deposited',
        image_url: imageUrl
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating deposit:', error);
      toast.error('ไม่สามารถบันทึกข้อมูลได้');
      return null;
    }

    return newTransaction;
  };

  const markAsCollected = async (transactionId: string) => {
    const { data, error } = await supabase
      .rpc('mark_transaction_collected', { p_transaction_id: transactionId });

    if (error) {
      console.error('Error marking as collected:', error);
      toast.error('ไม่สามารถอัปเดตสถานะได้');
      return false;
    }

    return true;
  };

  return {
    transactions,
    loading,
    fetchTransactions,
    getActiveTransactions,
    getTransactionByLocker,
    createDeposit,
    markAsCollected
  };
};
