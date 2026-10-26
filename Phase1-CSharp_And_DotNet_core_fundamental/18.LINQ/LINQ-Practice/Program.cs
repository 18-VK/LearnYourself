using System;
using System.Linq;
using LINQHelper;
using static System.Runtime.InteropServices.JavaScript.JSType;

//Basic
namespace LINQPractice
{

    class LINQPractSol
    {
        
        static SampleData SampleData = new SampleData();
        
        // Select the names of all products in the "Electronics" category.
        static void Basic_Prac1()
        {
            var result = SampleData.products.GroupBy(P => P.Category == "Electronics");

            // result has only one item as We have only one group in it 'Electronics'
            foreach(var item in result.ElementAt(0))
            {
                Console.WriteLine(item.Name);
            }

           // note : could be solved with where()
        }
        //Return the number of products in each category.
        static void Basic_Prac2()
        {
            var result = SampleData.products.GroupBy(P => P.Category);
            
            foreach(var item in result)
            {
                Console.WriteLine($"Category : {item.Key} , Count : {item.Count()}");
            }
        }
        // Get a List<Customer> of customers who joined before 2020.
        static void Basic_Prac3()
        {
            //var result = SampleData.customers.Where(C => DateTime.Compare(new DateTime(C.Joined.Year), new DateTime(2020)) < 0).ToList();
            var result = SampleData.customers.Where(C => C.Joined.Year < 2020);
           foreach(var item in result)
            {
                Console.WriteLine(item.Name);
            }

        }
        //Retrieve the highest product price in the catalog.
        static void Basic_Prac4()
        {
            var result = SampleData.products.Max(P => P.Price);

            Console.WriteLine(result.ToString());
        }

        // Check if any product has Stock == 0.

        static void Basic_Prac5()
        {
            var result = SampleData.products.Any(P => P.Stock == 0);

            Console.WriteLine(result == true ? "true" : "false");
        }
        // Calculate the average rating of products in the Clothing category.
        static void Basic_Prac6()
        {
            var result = SampleData.products.Where(P => P.Category?.ToLower() == "clothing").Select(P => P.Rating).Average();

            Console.WriteLine("Average rating of Clothing category in products list : " + Math.Round(result,2));

        }
        //Does every product in Electronics have rating >= 4.0?
        static void Basic_Prac7()
        {
            var result = SampleData.products.Where(P => P.Category?.ToLower() == "electronics").Any(P => P.Rating >= 4.0);
            Console.WriteLine("Is any product has rating of more than or eqaul to 4 : " + (result == true ? "Yes" : "No"));
        }
        //Return the first product whose stock is less than 20.
        static void Basic_Prac8()
        {
            var result = SampleData.products.Where(P => P.Stock < 20).FirstOrDefault();
            
            Console.WriteLine(" Product Name : " + result.Name);
        }

        /*
         Intermediate
        
         */

        // For each order, return an object with OrderId, CustomerName, and TotalOrderAmount.
        static void Intermediate_Prac1()
        {
            
            var Orders = SampleData.orders;

            var result = Orders.Join(SampleData.customers, O => O.CustomerId, C => C.Id, (O, C) => new
            {
                OrderId = O.Id,
                CustomerName = C.Name,
                TotalOrderAmount = O.Items.Sum(U => U.Quantity * U.UnitPrice)
            }); ;

           foreach(var item in result)
            {
                Console.WriteLine($"OrderId : {item.OrderId}, CustomerName : {item.CustomerName}, TotalOrderAmount : {item.TotalOrderAmount}");
            }
        }

        // List customers along with the count of orders they placed (include customers with zero orders).
        static void Intermediate_Prac2()
        {
            var Customers = SampleData.customers;
            var result = Customers.GroupJoin(SampleData.orders, C => C.Id, O => O.CustomerId,
                        (C, O) => new { Cust = C.Name, Orders = O.Count() });
            
            foreach(var item in result)
            {
                Console.WriteLine(item.Cust + " " + item.Orders);
            }
        }
        // List customers along with the count of orders they placed, now i want to count the total number of OrderItems per
        // customer (i.e., the total line items, not just orders).
        static void Intermediate_Prac3()
        {
            var Customers = SampleData.customers;

            var customerItemCounts = Customers.GroupJoin(
                                        SampleData.orders,
                                        c => c.Id,
                                        o => o.CustomerId,
                                        (c, customerOrders) => new
                                        {
                                            CustomerId = c.Id,
                                            CustomerName = c.Name,
                                            TotalItems = customerOrders
                                                            .SelectMany(o => o.Items)      // flatten all items of all orders for that customer
                                                            .Count()
                                        });
            foreach (var item in customerItemCounts)
            {
                Console.WriteLine(item.CustomerName + " " + item.TotalItems);
            }
        }
        //Get the top 3 best-selling products by total quantity ordered(product id + total quantity).
        static void Intermediate_Prac4()
        {
            var products = SampleData.products;

            var result = products.OrderByDescending(P => P.Stock).Take(3).Select((P) => new { P.Id, P.Stock });

            foreach(var item in result) { Console.WriteLine(item.Id + " " + item.Stock); }
        }
        //Using GroupJoin, list departments and the names of employees in each (include empty groups).
        static void Intermediate_Prac5()
        {
            var Departments = SampleData.departments;
            var emp = SampleData.employees;

            var result = Departments.GroupJoin(emp, D => D.Id, emp => emp.DepartmentId, (D, E) =>
                                    new { Dep = D.Name, Emps = E.Select(X => X.Name).ToList() });

            foreach (var item in result) {
                   Console.WriteLine(item.Dep + " " + string.Join(",", item.Emps));
            }
        }
        // Produce a dictionary mapping ProductId -> ProductName.
        static void Intermediate_Prac6()
        {
            var result = SampleData.products.ToDictionary(P => P.Id, P => P.Name);

            foreach(var item in result)
            {
                 Console.WriteLine(item.Key + " " + item.Value);
            }
        }
        //Given customers and orders, produce a list of customer names who have placed at least one order (no duplicates).
        static void Intermediate_Prac7()
        {
            var result = SampleData.customers.Join(SampleData.orders, C => C.Id, O => O.CustomerId, (C, O) => new { CustomerName = C.Name }).Distinct();

            foreach(var item in result )
            {
                Console.WriteLine("Customer name : " + item.CustomerName);
            }
        }
        // Create a Lookup that groups orders by CustomerId (ToLookup) and return orders for customer Id = 1 from the lookup.
        static void Intermediate_Prac8()
        {
            var result = SampleData.customers.GroupJoin(SampleData.orders, C => C.Id, O => O.CustomerId,
                                                        (C, O) => new { CustomerID = C.Id, Orders = O.Select(O => O.Id).ToList() }).Where(C => C.CustomerID == 1);

            foreach (var item in result)
            {
                Console.WriteLine("Customer name : " + item.CustomerID + " Orders : " +  string.Join( ", ", item.Orders));
            }
        }
        /*
         Advanced (5)

        

      

        
         * */

        //Using SelectMany, produce a flat list of (OrderId, ProductId, Quantity) for all order items.
        static void Advance_Prac1()
        {
            var result = SampleData.orders.SelectMany(O => O.Items ,(X,Y) => new{ Orderid = X.Id, ProductId = Y.ProductId, Quantity = Y.Quantity});

            foreach(var item in result)
            {
                Console.WriteLine(item.Orderid + " " + item.ProductId + " " + item.Quantity);
            }
        }
        //Compute the grand total revenue across all orders using Aggregate.
        static void Advance_Prac2()
        {
            var result = SampleData.orders.SelectMany(O => O.Items, (X, Y) =>
                        new { Price = Y.Quantity * Y.UnitPrice }).Sum(P => P.Price);

            Console.WriteLine(result);

        }
        // Using a custom IEqualityComparer<Product>, check if two product lists are sequence-equal by Name and Category.
        static void Advance_Prac3()
        {
            // if length mismatch then also it will be false
            var result = SampleData.products.SequenceEqual(SampleData.productsTemp, new ProductCompare());
            Console.WriteLine(result);
        }
        //  For each category return CategoryName and the most expensive product in that category.
        static void Advance_Prac4()
        {

            var result = SampleData.products.GroupBy(p => p.Category).Select(R => new { Category = R.Key, MaxPrice = R.Select(R => R.Price).Max() });
            foreach(var cat in result)
            {

                Console.WriteLine(cat.Category + " " + cat.MaxPrice);
            }
        }
        //From orders, find customers who placed more than one order within a 60-day window — return customer Ids.
        static void Advance_Prac5()
        {

            var groups = SampleData.orders
              .GroupBy(o => o.CustomerId)
              .Select(g => new { CustomerId = g.Key, Dates = g.Select(o => o.OrderDate).OrderBy(d => d).ToList() })
              .ToList();

            // 1) print consecutive date differences for customers that have multiple orders
            var result = groups
                .Where(g => g.Dates.Count >= 2)
                .Where(g => g.Dates
                            .Zip(g.Dates.Skip(1), (prev, next) => (next - prev).TotalDays)
                            .Any(days => days <= 70))
                .Select(g => g.CustomerId)
                .ToList();

            // Print list of customer ids
            foreach(var item in result)
            {
                Console.WriteLine("ID : " + item);

            }

        }
        // Create a projection that returns for each customer: CustomerName, TotalOrders, TotalSpent, AverageOrderValue.
        static void Advance_Prac6()
        {
            var result = SampleData.customers.GroupJoin(SampleData.orders,c => c.Id,o => o.CustomerId,
                                (c, orders) => new
                                {
                                    CustomerName = c.Name,
                                    TotalOrders = orders.Count(),
                                    // TotalSpent across all orders (sum of quantity * unitprice)
                                    TotalSpent = orders.Sum(ord => ord.Items.Sum(it => it.Quantity * it.UnitPrice)),
                                    // Average order value (average of each order's total). If no orders -> 0m
                                    AverageOrderValue = orders.Any()
                                        ? orders.Average(ord => ord.Items.Sum(it => it.Quantity * it.UnitPrice))
                                        : 0m
                                });

        }
        static void Main(string[] args)
        {
            //Basic_Prac1();
            //Basic_Prac2();
            //Basic_Prac3();
            //Basic_Prac4();
            //Basic_Prac5();
            //Basic_Prac6();
            //Basic_Prac7();
            //Basic_Prac8();
            //Intermediate_Prac1();
            //Intermediate_Prac2();
            //Intermediate_Prac3();
            //Intermediate_Prac4();
            //Intermediate_Prac5();
            //Intermediate_Prac6();
            //Intermediate_Prac7();
            Intermediate_Prac8();
            //Advance_Prac2();
            //Advance_Prac3();
            //Advance_Prac4();
            //Advance_Prac5();
        }
    }
} 