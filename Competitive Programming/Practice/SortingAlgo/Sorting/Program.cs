//Bubble sort
void BubbleSort(int[] input)
{
    int n = input.Length;
    bool swapped = false;
    for(int i = 0; i < n; i++)
    {
        for(int j = 1; j < (n - i); j++)
        {
            if(input[j-1] > input[j])
            {   
                (input[j], input[j-1]) = (input[j-1], input[j]);
                swapped = true;
            }
        }
        if(!swapped)
            break;
    }
}
// selection sort 
void SelectionSort(int[] input)
{
    int n = input.Length;
    for(int i = 0; i < n; i++)
    {
        int minidx = i;
        for(int j = i + 1; j < n; j++)
        {
            if(input[minidx] > input[j])
                minidx = j;
        }
        // now have index which has lowest value out of this array 
        if(minidx != i)
            (input[i], input[minidx]) = (input[minidx], input[i]);
    }
}

// insertion sort 
void InsertionSort(int[] input)
{
    int n = input.Length;
    for(int i = 1; i< n; i++)
    {
        //take sort portion(subarray) and take one element from that and place in
        // right position 
        int keyval = input[i];
        int j;
        for(j = i -1; j >=0; j--)
        {
            if(input[j] <= keyval)
                break;
            // shift
            input[j + 1] = input[j];
        }
        // place on right position 
        input[j+1] = keyval;
    }
}

// merge sort 
void MergeSort(int[] input, int start, int end)
{
    // edge case
    if(start >= end)
        return;

    // slip into 2 arrays
    int n = (end - start) + 1; // size of array
    int mid = start + (n -1)/2;
    MergeSort(input, start, mid);
    MergeSort(input, mid + 1, end);

    Merge(input, start, mid, end);

}
void Merge(int[] input, int start, int mid, int end)
{   

    int[] left = input[start..(mid+1)];
    int[] right = input[(mid+1)..(end+1)];

    int LL = left.Length, RL = right.Length; 
    int i = 0, j = 0;
    int k = start;
    //both together
    while(i < LL && j < RL)
    {
        if(right[j] > left[i])
        {
            input[k++] = left[i++];
        }   
        else
        {
            input[k++] = right[j++];
        }
    }

    while(i < LL)
    {
        input[k++] = left[i++];    
    }
    while(j < RL)
    {
        input[k++] = right[j++];    
    }
}
// heap sort 
void HeapSort(int[] input)
{
    int n = input.Length;
    //get max heap start from last non leaf node
    for(int i = (n/2) - 1; i >=0; i--)
    {
        //call heapify
        Heapify(input, n, i);
    }
    for(int i = (n-1); i > 0; i--)
    {
        (input[0], input[i]) = (input[i], input[0]);
        Heapify(input, i, 0);
    }
}
void Heapify(int[] input, int n, int i)
{
    int largest = i;
    int left = 2*i +1;
    int right = 2*i +2;

    if(left < n && input[left] > input[largest])
        largest = left;
    
    if(right < n && input[right] > input[largest])
        largest = right;

    if(largest != i)
    {
        (input[largest], input[i]) = (input[i], input[largest]);
        Heapify(input, n, largest);
    }
    
}

//counting sort 
void CountingSort(int[] input)
{
    int max = input.Max();
    int min = input.Min();
    int range = (max - min) + 1;

    int[] count = new int[range];

    for(int i =0; i < input.Length; i++)
    {
        count[(input[i] - min)]++;
    }

    // cumulative count
    for(int i = 1; i < count.Length; i++)
    {
        count[i] += count[i-1];
    }

    int[] output = new int[input.Length];
    for(int i = input.Length -1; i >= 0; i--)
    {
        int val = input[i];
        int idx = count[(val -min)]--;
        output[idx-1] = val;
    }
    Array.Copy(output, input, output.Length);
}

//quick sort 

void Quicksort(int[] input, int start, int end)
{
    if(start < end)
    {
        // partition 
        int partitionIdx = GetPartition(input, start, end);
        Quicksort(input, start, partitionIdx - 1);
        Quicksort(input, partitionIdx +1, end);
    }
}
int GetPartition(int[] input, int start, int end)
{
    int pivot = input[end];// last element
    
    int i = start -1;
    for(int j = start; j <= end; j++)
    {
        if(input[j] <= pivot)
        {
            i++;
            (input[i], input[j]) = (input[j], input[i]);
        }
    }
    (input[i +1], input[end]) = (input[end], input[i+1]);

    return i+1;
}
int GetPartition_2(int[] input, int start, int end)
{
    int pivot = input[end];// last element
    int i = end + 1;
    for(int j = end ; j >= start; j--)
    {
        if(input[j] >= pivot)
        {
            i--;
            (input[i] , input[j]) =(input[j], input[i]);
        }
    }
    (input[i], input[end]) = (input[end], input[i]);

    return i;
}

//Radix sort : not for non negative values only
void radixSort(int[] input)
{
    int num = input.Max();
    for(int exp = 1; num/ exp > 0; exp*=10)
    {
        // call counting sort for this
        countingSortForRadix(input,exp);
    }
}
void countingSortForRadix(int[] input, int exp)
{
    int n = input.Length;
    int[] output = new int[n];

    int[] count = new int [10];

    for(int i =0; i < n; i++)
    {
        int val = input[i];
        count[(val/exp) % 10]++;
    }
    // cumulative count 
    for(int i = 1; i < count.Length; i++)
    {
        count[i] += count[i-1];
    }
    for(int i = n - 1; i >= 0; i--)
    {
        int val = input[i]/exp % 10;
        output[(count[val]--) - 1] = input[i];
    }
    Array.Copy(output, input, n);
}
void RunCase(string name, int[] input)
{
    radixSort(input);
    Console.WriteLine($"{name}: {string.Join(" ", input)}");
}



// RunCase("Case 1", new[] { 5, 1, 4, 2, 3 });
// RunCase("Case 2", new[] { 10, 8, 0, 7, 2, -3 });
// RunCase("Case 3", new[] { 9, 9, 9, 9 });
// RunCase("Case 4", new[] { 42 });
// RunCase("Case 5", new[] { 1, 2, 3, 4, 5 });
// RunCase("Case 6", new[] { -5, -1, -9, -2, -7 });


//extra 

void sample()
{
    List<int> nums = new List<int>();
    nums.Add(1);
    nums.Add(5);
    nums.Insert(1,4);
    foreach(int num in nums)
    {
        Console.WriteLine(num);
    }
}   

sample();
