import { useState, useEffect } from 'react';
import { Journal, Asset, ChartData } from '../types';
import { loadJournals, saveJournals } from '../lib/storage';

export const useInvestmentData = () => {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);

  // Load journals on mount
  useEffect(() => {
    const loadedJournals = loadJournals();
    setJournals(loadedJournals);
  }, []);

  // Recalculate chart data whenever journals change
  useEffect(() => {
    const newChartData = calculateChartData(journals);
    setChartData(newChartData);
  }, [journals]);

  const calculateChartData = (journalList: Journal[]): ChartData[] => {
    // Sort journals by date
    const sortedJournals = [...journalList].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const chartDataMap = new Map<string, ChartData>();

    sortedJournals.forEach(journal => {
      const dateKey = journal.date;
      
      // Calculate total assets for this journal
      const totalAssets = journal.assets.reduce((sum, asset) => {
        return sum + (asset.quantity * asset.currentPrice);
      }, 0);

      // If we already have data for this date, update it
      // Otherwise, create new entry
      if (chartDataMap.has(dateKey)) {
        const existing = chartDataMap.get(dateKey)!;
        chartDataMap.set(dateKey, {
          ...existing,
          totalAssets: existing.totalAssets + totalAssets
        });
      } else {
        chartDataMap.set(dateKey, {
          date: dateKey,
          totalAssets: totalAssets,
          monthlyInvestment: 0 // This could be calculated based on your needs
        });
      }
    });

    // Convert map to array and sort by date
    const result = Array.from(chartDataMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate cumulative totals for better visualization
    let cumulativeTotal = 0;
    return result.map(item => {
      cumulativeTotal = item.totalAssets; // Use actual total, not cumulative
      return {
        ...item,
        totalAssets: cumulativeTotal
      };
    });
  };

  const addJournal = (journal: Journal) => {
    const updatedJournals = [...journals, journal];
    setJournals(updatedJournals);
    saveJournals(updatedJournals);
  };

  const updateJournal = (updatedJournal: Journal) => {
    const updatedJournals = journals.map(journal => 
      journal.id === updatedJournal.id ? updatedJournal : journal
    );
    setJournals(updatedJournals);
    saveJournals(updatedJournals);
  };

  const deleteJournal = (id: string) => {
    const updatedJournals = journals.filter(journal => journal.id !== id);
    setJournals(updatedJournals);
    saveJournals(updatedJournals);
  };

  const getAssetDistribution = () => {
    const assetMap = new Map<string, number>();
    
    journals.forEach(journal => {
      journal.assets.forEach(asset => {
        const currentValue = assetMap.get(asset.name) || 0;
        assetMap.set(asset.name, currentValue + (asset.quantity * asset.currentPrice));
      });
    });

    return Array.from(assetMap.entries()).map(([name, value]) => ({
      name,
      value,
      percentage: 0 // Will be calculated in the component
    }));
  };

  const getTotalAssetValue = () => {
    return journals.reduce((total, journal) => {
      return total + journal.assets.reduce((journalTotal, asset) => {
        return journalTotal + (asset.quantity * asset.currentPrice);
      }, 0);
    }, 0);
  };

  return {
    journals,
    chartData,
    addJournal,
    updateJournal,
    deleteJournal,
    getAssetDistribution,
    getTotalAssetValue
  };
};